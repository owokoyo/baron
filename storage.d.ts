declare namespace Storage {
  function getKeyValues(project: string, keys: {[key: string]: any}, finished?: Function): void
  function reply(query: {[key: string]: any}, dt: any, opts: {[s: string]: any, generator?: Function}, replyfunc: Function): void
  function setKeyValues(project: string, keys: {[key: string]: any}, finished?: Function): void

  export {
    setKeyValues,
    getKeyValues,
    reply
  }
}


export = Storage