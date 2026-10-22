const nativeFetch = (...args) => globalThis.fetch(...args);

export default nativeFetch;
export { nativeFetch as fetch };