// @flow

const keys = Object.keys;
const toString = Object.prototype.toString;
const jsonStringify = JSON.stringify;

export const INFINITY = Number.POSITIVE_INFINITY;

/**
 * @private
 *
 * @function splice
 *
 * @description
 * faster version of splicing a single item from the array
 *
 * @param {Array<*>} array array to splice from
 * @param {number} index index to splice at
 * @returns {Array<*>} array minus the item removed
 */
export const splice = (array: Array<any>, index: number): Array<any> => {
  const length: number = array.length;

  if (!length) {
    return array;
  }

  while (index < length) {
    array[index] = array[index + 1];
    index++;
  }

  array.length = length - 1;

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
 * @returns {Array<*>} array plus the item added to the front
 */
export const unshift = (array: Array<any>, item: number): Array<any> => {
  let length: number = array.length;

  while (length) {
    array[length] = array[length - 1];
    length--;
  }

  array[0] = item;

  return array;
};

/**
 * @private
 *
 * @function isComplexObject
 *
 * @description
 * is the object passed a complex object
 *
 * @param {*} object object to test if it is complex
 * @returns {boolean}
 */
export const isComplexObject = (object: any): boolean => {
  return typeof object === 'object' && object !== null;
};

/**
 * @private
 *
 * @function decycle
 *
 * @description
 * ES2015-ified version of cycle.decyle
 *
 * @param {*} object object to stringify
 * @returns {string} stringified value of object
 */
export const decycle = (object: any): string => {
  let objects = [],
      paths = [];

  const derez = (value: any, path: string): any => {
    if (isComplexObject(value) &&
      !(value instanceof Boolean) &&
      !(value instanceof Date)    &&
      !(value instanceof Number)  &&
      !(value instanceof RegExp)  &&
      !(value instanceof String)
    ) {
      let index = -1;

      while (++index < objects.length) {
        if (objects[index] === value) {
          return {
            $ref: paths[index]
          };
        }
      }

      objects.push(value);
      paths.push(path);

      if (toString.call(value) === '[object Array]') {
        let array = [],
          index = -1;

        while (++index < value.length) {
          array[index] = derez(value[index], `${path}[${index}]`);
        }

        return array;
      }

      let object = {};

      keys(value).forEach((name) => {
        object[name] = derez(value[name], `${path}[${JSON.stringify(name)}]`);
      });

      return object;
    }

    return value;
  };

  return derez(object, '$');
};

/**
 * @private
 *
 * @function getCacheKey
 *
 * @description
 * get the key used for storage in the method's cache
 *
 * @param {Array<*>} args arguments passed to the method
 * @param {function} serializer method used to serialize keys into a string
 * @returns {*}
 */
export const getCacheKey = (args: Array<any>, serializer: Function) => {
  return args.length === 1 ? args[0] : serializer(args);
};

/**
 * @private
 *
 * @function deleteItemFromCache
 *
 * @description
 * remove an item from cache and the usage list
 *
 * @param {Map|Object} cache caching mechanism for method
 * @param {Array<*>} usage order of key usage
 * @param {*} key key to delete
 */
export const deleteItemFromCache = (cache: Map<any, any>|Object, usage: Array<any>, key: any) => {
  const index: number = usage.indexOf(key);

  if (index !== -1) {
    splice(usage, index);
    cache.delete(key);
  }
};

/**
 * @private
 *
 * @function getFunctionWithCacheAdded
 *
 * @description
 * add the caching mechanism to the function passed and return the function
 *
 * @param {function} fn method that will have the cache added to it
 * @param {Map|Object} cache caching mechanism that has get / set / has methods
 * @returns {Function} method that has cache mechanism added to it
 */
export const getFunctionWithCacheAdded = (fn: Function, cache: Map<any, any>|Object) => {
  fn.cache = cache;
  fn.usage = [];

  /**
   * @private
   *
   * @function clear
   *
   * @description
   * clear the current cache for this method
   */
  fn.clear = () => {
    fn.cache.clear();
    fn.usage = [];
  };

  /**
   * @private
   *
   * @function delete
   *
   * @description
   * delete the cache for the key passed for this method
   *
   * @param {*} key key to remove from cache
   */
  fn.delete = (key: any) => {
    deleteItemFromCache(fn.cache, fn.usage, key);
  };

  return fn;
};

/**
 * @private
 *
 * @function isEqual
 *
 * @description
 * are the two values passed equal or both NaN
 *
 * @param {*} value1 first value to check equality for
 * @param {*} value2 second value to check equality for
 * @returns {boolean} are the two values equal
 */
export const isEqual = (value1: any, value2: any): boolean => {
  return value1 === value2 || (value1 !== value1 && value2 !== value2);
};

/**
 * @private
 *
 * @function getIndexOf
 *
 * @description
 * get the index of the key in the map
 *
 * @param {MapLike} map map to find key in
 * @param {*} key key to find in map
 * @returns {number} index location of key in list
 */
export const getIndexOf = (map: Object, key: any): number => {
  let index: number = -1;

  while (++index < map.size) {
    if (isEqual(map.list[index].key, key)) {
      return index;
    }
  }

  return -1;
};

/**
 * @private
 *
 * @function stringify
 *
 * @description
 * stringify with a custom replacer if circular, else use standard JSON.stringify
 *
 * @param {*} value value to stringify
 * @returns {string} the stringified version of value
 */
export const stringify = (value: any) => {
  try {
    return jsonStringify(value);
  } catch (exception) {
    return jsonStringify(decycle(value));
  }
};

/**
 * @private
 *
 * @function getStringifiedArgument
 *
 * @description
 * get the stringified version of the argument passed
 *
 * @param {*} arg argument to stringify
 * @returns {string}
 */
export const getStringifiedArgument = (arg: any) => {
  return isComplexObject(arg) ? stringify(arg) : arg;
};

/**
 * @private
 *
 * @function isKeyLastItem
 *
 * @description
 * is the key passed the same key as the lastItem
 *
 * @param {{key: *, value: *}} lastItem the current lastItem in the Map
 * @param {*} key the key to match on
 * @returns {boolean} is the key the same as the LastItem
 */
export const isKeyLastItem = (lastItem: ?Object, key: any): boolean => {
  return !!lastItem && isEqual(lastItem.key, key);
};

/**
 * @private
 *
 * @function serializeArguments
 *
 * @description
 * serialize the arguments into a string
 *
 * @param {Array<*>} args arguments to serialize into string
 * @returns {string} string of serialized arguments
 */
export const serializeArguments = (args: Array<any>) => {
  const length: number = args.length;

  let index: number = -1,
      key: string = '|';

  while (++index < length) {
    key += `${getStringifiedArgument(args[index])}|`;
  }

  return key;
};

/**
 * @private
 *
 * @function setExpirationOfCache
 *
 * @description
 * set the cache to expire after the maxAge passed (coalesced to 0)
 *
 * @param {function} fn memoized function with cache and usage storage
 * @param {*} key key in cache to expire
 * @param {number} maxAge number in ms to wait before expiring the cache
 */
export const setExpirationOfCache = (fn: Function, key: any, maxAge: number) => {
  const {
    cache,
    usage
  } = fn;

  const expirationTime = Math.max(maxAge, 0);

  setTimeout(() => {
    deleteItemFromCache(cache, usage, key);
  }, expirationTime);
};

/**
 * @private
 *
 * @function setNewCachedValue
 *
 * @description
 * assign the new value to the key in the functions cache and return the value
 *
 * @param {function} fn method whose cache will have new value assigned
 * @param {*} key key in cache to assign value to
 * @param {*} value value to store in cache
 * @param {boolean} isPromise is the value a promise or not
 * @param {boolean} isMaxAgeFinite does the cache have a maxAge or not
 * @param {number} maxAge how long should the cache persist
 * @returns {any} value just stored in cache
 */
export const setNewCachedValue = (
  fn: Function,
  key: any,
  value: any,
  isPromise: boolean,
  isMaxAgeFinite: boolean,
  maxAge: number
) => {
  if (isPromise) {
    value.then((resolvedValue) => {
      fn.cache.set(key, resolvedValue);
    });
  } else {
    fn.cache.set(key, value);
  }

  if (isMaxAgeFinite) {
    setExpirationOfCache(fn, key, maxAge);
  }

  return value;
};


/**
 * @private
 *
 * @function setUsageOrder
 *
 * @description
 * place the key passed at the front of the array, removing it from its current index if it
 * exists and removing the last item in the array if it is larger than maxSize
 *
 * @param {function} fn memoized function storing cache
 * @param {Map} fn.cache caching mechanism used by memoized function
 * @param {Array<*>} fn.usage array of keys in order of most recently used
 * @param {*} key key to place at the front of the array
 * @param {number} maxSize the maximum size of the cache
 */
export const setUsageOrder = (fn: Function, key: any, maxSize: number) => {
  const {
    cache,
    usage
  } = fn;
  const index: number = usage.indexOf(key);

  if (index !== 0) {
    if (index !== -1) {
      splice(usage, index);
    }

    unshift(usage, key);

    if (usage.length > maxSize) {
      deleteItemFromCache(cache, usage, usage[usage.length - 1]);
    }
  }
};
