// @flow

// cache
import Cache from './Cache';

// cache key
import ReactCacheKey from './ReactCacheKey';
import SerializedCacheKey from './SerializedCacheKey';
import SingleParameterCacheKey from './SingleParameterCacheKey';
import MultipleParameterCacheKey from './MultipleParameterCacheKey';

// constants
import {
  DEFAULT_OPTIONS,
  FINITE_POSITIVE_INTEGER,
  FUNCTION_NAME_REGEXP,
  FUNCTION_TYPEOF,
  GOTCHA_OBJECT_CLASSES,
  INVALID_PROMISE_LIBRARY_ERROR,
  OBJECT_TYPEOF,
  STATIC_PROPERTIES_TO_PASS
} from './constants';

// serialize
import {getSerializerFunction} from './serialize';

// types
import type {ListItem, Options} from './types';

type StandardCacheKey = MultipleParameterCacheKey | SingleParameterCacheKey;
type CacheKey = ReactCacheKey | SerializedCacheKey | StandardCacheKey;

/**
 * @private
 *
 * @function isComplexObject
 *
 * @description
 * is the object passed a complex object
 *
 * @param {*} object object to test if it is complex
 * @returns {boolean} is it a complex object
 */
export const isComplexObject = (object: any): boolean => {
  return !!object && typeof object === OBJECT_TYPEOF;
};

/**
 * @private
 *
 * @function isFiniteAndPositiveInteger
 *
 * @description
 * is the number passed an integer that is finite and positive
 *
 * @param {number} number number to test for finiteness and positivity
 * @returns {boolean} is the number finite and positive
 */
export const isFiniteAndPositiveInteger = (number: number): boolean => {
  return FINITE_POSITIVE_INTEGER.test(`${number}`);
};

/**
 * @private
 *
 * @function isFunction
 *
 * @description
 * is the object passed a function or not
 *
 * @param {*} object object to test
 * @returns {boolean} is it a function
 */
export const isFunction = (object: any): boolean => {
  return typeof object === FUNCTION_TYPEOF;
};

/**
 * @private
 *
 * @function isMoized
 *
 * @description
 * is the function passed a moized function or not
 *
 * @param {*} fn the function to get if moize
 * @returns {boolean} is the function moized or not
 */
export const isMoized = (fn: any): boolean => {
  return isFunction(fn) && !!fn.isMoized;
};

/**
 * @private
 *
 * @function isPlainObject
 *
 * @description
 * is the object passed a plain object or not
 *
 * @param {*} object object to test
 * @returns {boolean} is it a plain object
 */
export const isPlainObject = (object: any): boolean => {
  return isComplexObject(object) && object.constructor === Object;
};

/**
 * @private
 *
 * @function isValueObjectOrArray
 *
 * @description
 * check if the object is actually an object or array
 *
 * @param {*} object object to test
 * @returns {boolean} is the object an object or array
 */
export const isValueObjectOrArray = (object: any): boolean => {
  if (!isComplexObject(object)) {
    return false;
  }

  let index = 0;

  while (index < GOTCHA_OBJECT_CLASSES.length) {
    if (object instanceof GOTCHA_OBJECT_CLASSES[index]) {
      return false;
    }

    index++;
  }

  return true;
};

/**
 * @private
 *
 * @function take
 *
 * @description
 * take the first N number of items from the array (faster than slice)
 *
 * @param {number} size the number of items to take
 * @returns {function(Array<*>): Array<*>} the shortened array
 */
export const take = (size: number) => {
  return (array: Array<any>): Array<any> => {
    if (size >= array.length) {
      return array;
    }

    switch (size) {
      case 1:
        return [array[0]];

      case 2:
        return [array[0], array[1]];

      case 3:
        return [array[0], array[1], array[2]];

      case 4:
        return [array[0], array[1], array[2], array[3]];

      case 5:
        return [array[0], array[1], array[2], array[3], array[4]];
    }

    return array.slice(0, size);
  };
};

/**
 * @private
 *
 * @function addStaticPropertiesToFunction
 *
 * @description
 * add static properties to the memoized function if they exist on the original
 *
 * @param {function} originalFunction the function to be memoized
 * @param {function} memoizedFn the higher-order memoized function
 * @returns {function} memoizedFn with static properties added
 */
export const addStaticPropertiesToFunction = (
  originalFunction: Function,
  memoizedFn: Function
): Function => {
  let index: number = STATIC_PROPERTIES_TO_PASS.length,
    property: string;

  while (index--) {
    property = STATIC_PROPERTIES_TO_PASS[index];

    if (originalFunction[property]) {
      memoizedFn[property] = originalFunction[property];
    }
  }

  return memoizedFn;
};

/**
 * @private
 *
 * @function compose
 *
 * @description
 * method to compose functions and return a single function
 *
 * @param {...Array<function>} functions the functions to compose
 * @returns {function(...Array<*>): *} the composed function
 */
export const compose = (...functions: Array<Function>): Function => {
  return functions.reduce((f: Function, g: Function): Function => {
    return (...args: Array<any>): any => {
      return f(g(...args));
    };
  });
};

/**
 * @private
 *
 * @function createCurriableOptionMethod
 *
 * @description
 * create a method that will curry moize with the option + value passed
 *
 * @param {function} fn the method to call
 * @param {string} option the name of the option to apply
 * @param {*} value the value to assign to option
 * @returns {function} the moizer with the option pre-applied
 */
export const createCurriableOptionMethod = (
  fn: Function,
  option: string
): Function => {
  return function(value: any): Function {
    return fn({
      [option]: value
    });
  };
};

/**
 * @private
 *
 * @function createFindIndex
 *
 * @description
 * create a findIndex method based on the startingIndex passed
 *
 * @param {number} startingIndex the index to start in the find method returned
 * @returns {function(Array<ListItem>, *): number} the findIndex method
 */
export const createFindIndex = (startingIndex: number): Function => {
  // eslint-disable-line no-use-before-define
  return (list: Array<ListItem>, key: any): number => {
    let index: number = startingIndex;

    while (index < list.length) {
      if (key === list[index].key) {
        return index;
      }

      index++;
    }

    return -1;
  };
};

/**
 * @private
 *
 * @function createPluckFromInstanceList
 *
 * @description
 * get a property from the list on the cache
 *
 * @param {{list: Array<Object>}} cache cache whose list to map over
 * @param {string} key key to pluck from list
 * @returns {Array<*>} array of values plucked at key
 */
export const createPluckFromInstanceList = (
  cache: Cache,
  key: string
): Function => {
  return (): Array<any> => {
    return cache.list.map((item: ListItem) => {
      return item[key];
    });
  };
};

/**
 * @private
 *
 * @function createPromiseRejecter
 *
 * @description
 * create method that will reject the promise and delete the key from cache
 *
 * @param {Cache} cache cache to update
 * @param {*} key key to delete from cache
 * @param {function} promiseLibrary the promise library used
 * @returns {function} the rejecter function for the promise
 */
export const createPromiseRejecter = (
  cache: Cache,
  key: any,
  {promiseLibrary}: Options
): Function => {
  return (exception: Error): Promise<any> => {
    cache.remove(key);

    return promiseLibrary.reject(exception);
  };
};

/**
 * @private
 *
 * @function createPromiseResolver
 *
 * @description
 * create method that will resolve the promise and update the key in cache
 *
 * @param {Cache} cache cache to update
 * @param {*} key key to update in cache
 * @param {boolean} hasMaxAge should the cache expire after some time
 * @param {number} maxAge the age after which the cache will be expired
 * @param {function} promiseLibrary the promise library used
 * @returns {function} the resolver function for the promise
 */
export const createPromiseResolver = (
  cache: Cache,
  key: any,
  hasMaxAge: boolean,
  {maxAge, promiseLibrary}: Options
) => {
  return (resolvedValue: any): Promise<any> => {
    cache.update(key, promiseLibrary.resolve(resolvedValue));

    if (hasMaxAge) {
      cache.expireAfter(key, maxAge);
    }

    return resolvedValue;
  };
};

/**
 * @private
 *
 * @function findIndex
 *
 * @description
 * find the index of the key starting at the first index
 *
 * @param {Array<ListItem>} list the list to find the key in
 * @param {*} key the key to test against
 * @returns {number} the index of the matching key, or -1
 */
export const findIndex: Function = createFindIndex(0);

/**
 * @private
 *
 * @function findIndexAfterFirst
 *
 * @description
 * find the index of the key starting at the second index
 *
 * @param {Array<ListItem>} list the list to find the key in
 * @param {*} key the key to test against
 * @returns {number} the index of the matching key, or -1
 */
export const findIndexAfterFirst: Function = createFindIndex(1);

/**
 * @private
 *
 * @function getDefaultedOptions
 *
 * @description
 * get the options coalesced to their defaults
 *
 * @param {Object} options the options passed to the moize method
 * @returns {Options} the coalesced options object
 */
export const getDefaultedOptions = (options: Object): Options => {
  let coalescedOptions: Object = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  if (coalescedOptions.serialize) {
    coalescedOptions.serializer = getSerializerFunction(coalescedOptions);
  }

  return coalescedOptions;
};

/**
 * @private
 *
 * @function getFunctionNameViaRegexp
 *
 * @description
 * use regexp match on stringified function to get the function name
 *
 * @param {function} fn function to get the name of
 * @returns {string} function name
 */
export const getFunctionNameViaRegexp = (fn: Function): string => {
  const match: ?Array<string> = fn.toString().match(FUNCTION_NAME_REGEXP);

  return match ? match[1] : '';
};

/**
 * @private
 *
 * @function getFunctionName
 *
 * @description
 * get the function name, either from modern property or regexp match,
 * falling back to generic string
 *
 * @param {function} fn function to get the name of
 * @returns {string} function name
 */
export const getFunctionName = (fn: Function): string => {
  return (
    fn.displayName || fn.name || getFunctionNameViaRegexp(fn) || FUNCTION_TYPEOF
  );
};

/**
 * @private
 *
 * @function getKeyCount
 *
 * @description
 * get the count of keys in the object (faster than Object.keys().length)
 * 
 * @param {Object} object the object to get the key count of
 * @returns {number} the count of keys
 */
export const getKeyCount = (object: Object): number => {
  let counter = 0;

  for (let ignored in object) {
    counter++;
  }

  return counter;
};

/**
 * @private
 *
 * @function getReactCacheKey
 *
 * @description
 * get the cache key specific to react
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new ReactCacheKey
 * @returns {ReactCacheKey} the matching cache key, or a new one
 */
export const getReactCacheKey = (
  cache: Cache,
  key: Array<any>
): ReactCacheKey => {
  // $FlowIgnore if cache has size, the key exists
  if (cache.size && cache.lastItem.key.matches(key)) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    // $FlowIgnore if cache has size, the key exists
    if (cache.list[index].key.matches(key)) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return new ReactCacheKey(key);
};

/**
 * @private
 *
 * @function getReactCacheKey
 *
 * @description
 * get the cache key specific to react
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new ReactCacheKey
 * @param {Options} options the options passed to the moized method
 * @returns {ReactCacheKey} the matching cache key, or a new one
 */
export const getReactCacheKeyCustomEquals = (
  cache: Cache,
  key: Array<any>,
  options: Options
): ReactCacheKey => {
  // $FlowIgnore if cache has size, the key exists
  if (cache.size && cache.lastItem.key.matchesCustom(key, options.equals)) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    // $FlowIgnore if cache has size, the key exists
    if (cache.list[index].key.matchesCustom(key, options.equals)) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return new ReactCacheKey(key);
};

/**
 * @private
 *
 * @function getSerializedCacheKey
 *
 * @description
 * get the cache key specific to serialized methods
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new SerializedCacheKey
 * @param {Options} options the options passed to the moized method
 * @returns {SerializedCacheKey} the matching cache key, or a new one
 */
export const getSerializedCacheKey = (
  cache: Cache,
  key: Array<any>
): SerializedCacheKey => {
  // $FlowIgnore if cache has size, the key exists
  if (cache.size && cache.lastItem.key.matches(key)) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    // $FlowIgnore if cache has size, the key exists
    if (cache.list[index].key.matches(key)) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return new SerializedCacheKey(key);
};

/**
 * @private
 *
 * @function getSerializedCacheKeyCustomEquals
 *
 * @description
 * get the cache key specific to serialized methods
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new SerializedCacheKey
 * @param {Options} options the options passed to the moized method
 * @returns {SerializedCacheKey} the matching cache key, or a new one
 */
export const getSerializedCacheKeyCustomEquals = (
  cache: Cache,
  key: Array<any>,
  options: Options
): SerializedCacheKey => {
  if (
    cache.size &&
    // $FlowIgnore if cache has size, the key exists
    cache.lastItem.key.matchesCustom(key, options.equals)
  ) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    // $FlowIgnore if cache has size, the key exists
    if (cache.list[index].key.matchesCustom(key, options.equals)) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return new SerializedCacheKey(key);
};

/**
 * @private
 *
 * @function getStandardCacheKey
 *
 * @description
 * get the cache key for standard parameters, either single or multiple
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new Multiple / SingleParameterCacheKey
 * @returns {StandardCacheKey} the matching cache key, or a new one
 */
export const getStandardCacheKey = (
  cache: Cache,
  key: Array<any>
): StandardCacheKey => {
  const isMultiParamKey: boolean = key.length > 1;

  // $FlowIgnore if cache has size, the key exists
  if (cache.size && cache.lastItem.key.matches(key, isMultiParamKey)) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    // $FlowIgnore if cache has size, the key exists
    if (cache.list[index].key.matches(key, isMultiParamKey)) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return isMultiParamKey
    ? new MultipleParameterCacheKey(key)
    : new SingleParameterCacheKey(key);
};

/**
 * @private
 *
 * @function getStandardCacheKeyCustomEquals
 *
 * @description
 * get the cache key for standard parameters, either single or multiple
 *
 * @param {Cache} cache the cache to find a potential matching key in
 * @param {*} key the key to try to find a match of, or turn into a new Multiple / SingleParameterCacheKey
 * @param {Options} options the options passed to the moized method
 * @returns {StandardCacheKey} the matching cache key, or a new one
 */
export const getStandardCacheKeyCustomEquals = (
  cache: Cache,
  key: Array<any>,
  options: Options
): StandardCacheKey => {
  const isMultiParamKey: boolean = key.length > 1;

  if (
    cache.size &&
    // $FlowIgnore if cache has size, the key exists
    cache.lastItem.key.matchesCustom(key, isMultiParamKey, options.equals)
  ) {
    // $FlowIgnore if the key matches, the key exists
    return cache.lastItem.key;
  }

  let index: number = 1;

  while (index < cache.size) {
    if (
      // $FlowIgnore if cache has size, the key exists
      cache.list[index].key.matchesCustom(key, isMultiParamKey, options.equals)
    ) {
      // $FlowIgnore if the key matches, the key exists
      return cache.list[index].key;
    }

    index++;
  }

  return isMultiParamKey
    ? new MultipleParameterCacheKey(key)
    : new SingleParameterCacheKey(key);
};

/**
 * @private
 *
 * @function getGetCacheKeyMethod
 *
 * @description
 * based on the options, get the getCacheKey method
 *
 * @param {Options} options the options passed to the moized method
 * @returns {function(Cache, Array<*>): CacheKey} the cache key
 */
export const getGetCacheKeyMethod = (options: Options): Function => {
  if (options.isReact) {
    return options.equals ? getReactCacheKeyCustomEquals : getReactCacheKey;
  }

  if (options.serialize) {
    return options.equals
      ? getSerializedCacheKeyCustomEquals
      : getSerializedCacheKey;
  }

  return options.equals ? getStandardCacheKeyCustomEquals : getStandardCacheKey;
};

/**
 * @private
 *
 * @function createGetCacheKey
 *
 * @description
 * create the method that will get the cache key based on the options passed to the moized method
 *
 * @param {Cache} cache the cache to get the key from
 * @param {Options} options the options passed to the moized method
 * @returns {function(*): CacheKey} the method that will get the cache key
 */
export const createGetCacheKey = (cache: Cache, options: Options): Function => {
  const hasMaxArgs: boolean = isFiniteAndPositiveInteger(options.maxArgs);
  const getCacheKeyMethod: Function = getGetCacheKeyMethod(options);

  let transform = options.transformArgs;

  if (hasMaxArgs) {
    transform = transform
      ? compose(transform, take(options.maxArgs))
      : take(options.maxArgs);
  }

  if (options.serialize) {
    transform = transform
      ? compose(options.serializer, transform)
      : options.serializer;
  }

  if (options.equals) {
    if (transform) {
      return (key: any): CacheKey => {
        // $FlowIgnore transform is a function
        return getCacheKeyMethod(cache, transform(key), options);
      };
    }

    return (key: any): CacheKey => {
      return getCacheKeyMethod(cache, key, options);
    };
  }

  if (transform) {
    return (key: any): CacheKey => {
      // $FlowIgnore transform is a function
      return getCacheKeyMethod(cache, transform(key));
    };
  }

  return (key: any): CacheKey => {
    return getCacheKeyMethod(cache, key);
  };
};

/**
 * @private
 *
 * @function createSetNewCachedValue
 *
 * @description
 * assign the new value to the key in the functions cache and return the value
 *
 * @param {Cache} cache the cache to assign the value to at key
 * @param {Options} options the options passed to the moize method
 * @returns {function(function, *, *): *} value just stored in cache
 */
export const createSetNewCachedValue = (
  cache: Cache,
  options: Options
): Function => {
  const hasMaxAge: boolean = isFiniteAndPositiveInteger(options.maxAge);
  const hasMaxSize: boolean = isFiniteAndPositiveInteger(options.maxSize);

  const {maxAge, maxSize} = options;

  if (options.isPromise) {
    if (
      !isFunction(options.promiseLibrary) &&
      !isPlainObject(options.promiseLibrary)
    ) {
      throw new TypeError(INVALID_PROMISE_LIBRARY_ERROR);
    }

    return (key: any, value: any): Promise<any> => {
      const promiseResolver = createPromiseResolver(
        cache,
        key,
        hasMaxAge,
        options
      );
      const promiseRejecter = createPromiseRejecter(cache, key, options);
      const handler = value.then(promiseResolver, promiseRejecter);

      cache.add(key, handler);

      if (hasMaxSize && cache.size > maxSize) {
        cache.remove(cache.list[cache.list.length - 1].key);
      }

      return handler;
    };
  }

  return (key: any, value: any): any => {
    cache.add(key, value);

    if (hasMaxAge) {
      cache.expireAfter(key, maxAge);
    }

    if (hasMaxSize && cache.size > maxSize) {
      cache.remove(cache.list[cache.list.length - 1].key);
    }

    return value;
  };
};

/**
 * @private
 *
 * @function splice
 *
 * @description
 * faster version of splicing a single item from the array
 *
 * @param {Array<*>} array array to splice from
 * @param {number} startingIndex index to splice at
 * @returns {Array<*>} array minus the item removed
 */
export const splice = (
  array: Array<any>,
  startingIndex: number
): Array<any> => {
  if (!array.length) {
    return array;
  }

  let index: number = startingIndex - 1;

  while (++index < array.length) {
    array[index] = array[index + 1];
  }

  array.length -= 1;

  return array;
};

/**
 * @private
 *
 * @function unshift
 *
 * @description
 * faster version of unshifting a single item into an array
 *
 * @param {Array<*>} array array to unshift into
 * @param {*} item item to unshift into array
 * @returns {*} the item just added to the array
 */
export const unshift = (array: Array<any>, item: any): any => {
  let index: number = array.length;

  while (index--) {
    array[index + 1] = array[index];
  }

  return (array[0] = item);
};

/**
 * @private
 *
 * @function createAddPropertiesToFunction
 *
 * @description
 * add the static properties to the moized function
 *
 * @param {Cache} cache the cache for the moized function
 * @param {function} originalFunction the function to be moized
 * @param {Options} options the options passed to the moize method
 * @returns {function(function): function} the method which will add the static properties
 */
export const createAddPropertiesToFunction = (
  cache: Cache,
  originalFunction: Function,
  options: Options
) => {
  const getCacheKey = createGetCacheKey(cache, options);

  return (moizedFunction: Function): Function => {
    moizedFunction.cache = cache;
    moizedFunction.displayName = `moize(${getFunctionName(originalFunction)})`;
    moizedFunction.isMoized = true;
    moizedFunction.options = options;
    moizedFunction.originalFunction = originalFunction;

    /**
     * @private
     *
     * @function add
     *
     * @description
     * manually add an item to cache if the key does not already exist
     *
     * @param {Array<any>} key key to use in cache
     * @param {*} value value to assign to key
     */
    moizedFunction.add = (key: Array<any>, value: any) => {
      const internalKey = getCacheKey(key);

      if (!cache.has(internalKey)) {
        cache.add(internalKey, value);
      }
    };

    /**
     * @private
     *
     * @function clear
     *
     * @description
     * clear the current cache for this method
     */
    moizedFunction.clear = () => {
      cache.clear();
    };

    /**
     * @private
     *
     * @function has
     *
     * @description
     * does the function have cache for the specific args passed
     *
     * @param {Array<*>} key combination of args to remove from cache
     * @returns {boolean} does the cache for the give args exist
     */
    moizedFunction.has = (key: Array<any>) => {
      return cache.has(getCacheKey(key));
    };

    /**
     * @private
     *
     * @function keys
     *
     * @description
     * get the list of keys currently in cache
     *
     * @returns {Array<*>}
     */
    moizedFunction.keys = createPluckFromInstanceList(cache, 'key');

    /**
     * @private
     *
     * @function remove
     *
     * @description
     * remove the item from cache for the key passed for this method
     *
     * @param {Array<*>} key combination of args to remove from cache
     */
    moizedFunction.remove = (key: Array<any>) => {
      cache.remove(getCacheKey(key));
    };

    /**
     * @private
     *
     * @function values
     *
     * @description
     * get the list of values currently in cache
     *
     * @returns {Array<*>}
     */
    moizedFunction.values = createPluckFromInstanceList(cache, 'value');

    return addStaticPropertiesToFunction(originalFunction, moizedFunction);
  };
};
