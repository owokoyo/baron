/*
Created by Owokoyo
Nov 25 2020
*/

const games = {

}
var url = "s-usc1c-nss-277.firebaseio.com";

const cache = {};
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const WebSocketClient = require('websocket').client;
let globalindex = 0;
const maxreservedindex = 3000;

/*
function generateglobalindex(){
  globalindex++;
  if (globalindex>maxreservedindex) {
    globalindex = 0
  }
  return globalindex
}
*/

function generateindex(gameid){
  if (games[gameid] == undefined || ++games[gameid]>maxreservedindex) {
    games[gameid] = 0;
  }
  return games[gameid];
}

function getCred(project, callback){
  if (cache[project]) {
    callback(cache[project])
  } else {
    axios.get(`https://studio.code.org/v3/channels/${project}`).then(data=>{
      axios.get(`https://studio.code.org${data.data.level}/${project}`).then(response=>{
        var cred = response.data.match(/"firebaseAuthToken":"(.+)","firebaseSharedAuthToken"/)[1]
        cache[project] = cred
        callback(cred)
      })
    })
  }
}

function setKeyValues(project, values, callback){
  getCred(project, function(cred){
    var client = new WebSocketClient();
    client.on('connect', connection=>{
      let indexes = {}
      connection.on('message', servermessage=>{
        servermessage = JSON.parse(servermessage.utf8Data)
        if (servermessage.t==="c" && servermessage.d.t==="r") {
          url = servermessage.d.d;
          console.log("url switch")
        
          setKeyValues(project, values, callback)
        }
        if (servermessage.d && servermessage.d.r) {
          if (indexes[servermessage.d.r]!=undefined) {
            indexes[servermessage.d.r] = true
            let works = true
            for (bkey in indexes) {
              if (!indexes[bkey]) {
                works = false
                break
              }
            }
            if (works && callback) {
              callback()
            }
          }
        }
      })

      connection.sendUTF(JSON.stringify({"t":"d","d":{"r":2,"a":"auth","b":{"cred":cred}}}))
      for (key in values) {
        let i = Object.keys(indexes).length+4;
        indexes[i] = false
        let value = values[key];
        let message = {"t":"d","d":{"r":i,"a":"p","b":{"p":"/v3/channels/"+project+"/storage/keys/"+key,"d":JSON.stringify(value)}}};
        connection.sendUTF(JSON.stringify(message));
      }
    })
    client.connect("wss://"+url+"/.ws?v=5&ns=cdo-v3-prod")
  })
}
function getKeyValues(project, values, callback){
  getCred(project, function(cred){
    var client = new WebSocketClient();
    client.on('connect', connection=>{
      connection.sendUTF(JSON.stringify({"t":"d","d":{"r":2,"a":"auth","b":{"cred":cred}}}))
      let response = {}
      let indexes = {};
      connection.on('message', servermessage=>{
        servermessage = JSON.parse(servermessage.utf8Data)
        if (servermessage.t==="c") {
          url = servermessage.d.d;
          console.log("url switch")
        
          setKeyValues(project, values, callback)
        }
        if (servermessage.d && servermessage.d.r) {
          if (indexes[servermessage.d.r]!=undefined) {
            indexes[servermessage.d.r] = true
            let works = true
            for (bkey in indexes) {
              if (!indexes[bkey]) {
                works = false
                break
              }
            }
            if (works && callback) {
              callback(response)
            }
          }
        } else if (servermessage.d.b && servermessage.d.b.p) {
          let matched = servermessage.d.b.p.match(/storage\/keys\/(.+)$/)[1]
          if (matched && values.indexOf(matched)>=0) {
            response[matched] = servermessage.d.b.d
          }
        }
      })
      for (key of values) {
        let i = Object.keys(indexes).length+4;
        indexes[i] = false
        let message = {"t":"d","d":{"r":i,"a":"q","b":{"p":"/v3/channels/"+project+"/storage/keys/"+key,"h":""}}}
        connection.sendUTF(JSON.stringify(message))
      }
    })
    client.connect("wss://"+url+"/.ws?v=5&ns=cdo-v3-prod")
  })
}

function splitstring(stringtosplit){
  const len = 2000;
  let chunks = [];
  while (stringtosplit.length>len) {
      chunks.push(stringtosplit.substring(0, len));
      stringtosplit = stringtosplit.substring(len);
  }
  chunks.push(stringtosplit)
  return chunks;
}

function reply(query, dt, opts, replyfunc){
  dt = JSON.stringify(dt)
  let chunks = splitstring(dt)
  let data = {}
  let keys = [];
  for (let chunk of chunks) {
    let key = (opts.generator && opts.generator()) || "baron:"+generateindex(query.$gameid) //LynX TemPorary Key
    keys.push(key)
    data[key] = chunk
  }
  setKeyValues(query.$gameid, data, function(){
    replyfunc({$keys:keys,$mode:"storage"})

    //remove the temporary key after a short while
/*
    setTimeout(function(){
      for (k in data) {
        data[k] = undefined
      }
      setKeyValues(query.gameId, data)
    }, 10000)
*/
  })
}

module.exports = {
  setKeyValues: setKeyValues,
  getKeyValues:getKeyValues,
  reply: reply,
}
