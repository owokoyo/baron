/*
  Created by Owokoyo
  11/14/2020
  Updated 3/17/2021
*/



import encode from "./encode";
import uniqueId from "./uniqueId";
import storage from "./storage";

import express from 'express';
import bp from 'body-parser';
import * as fs from 'fs';
import path from 'path';
import {v4} from 'uuid';

type responseType = "bulk" | "secure"
type Query = {[key: string]:any, $id: string, $gameid: string, $userid: string, $timestamp: string, $forcemode: boolean | number, $text: boolean | number}
const PORT = process.env.PORT || '5000';
let expressInstance = express();

expressInstance.use(bp.json()); // for parsing application/json

function transformQuery(query: {[key: string]:any}){
  const q = {} as Query;
  for (let p in query) {
    q[p] = JSON.parse(query[p]);
  }
  q.$id = uniqueId(q.$gameid, q.$userid, q.$timestamp)
  return q;
}

type ReplyOptions = {text?: boolean, forcemode?: responseType, defaultmode?: responseType};
function generateReplyFunction(query: Query, res: express.Response){
  return function(response: any, options: ReplyOptions = {}){
    if (response) {
      response.$status = "success"
    }
    const mode = options.forcemode || query.$forcemode || options.defaultmode || "secure";
    if (query.$text || options.text){
      //send the response as text if ?$text=true
      if (query.$contenttype) {
        res.contentType(query.$contenttype)
      }
      console.log(response);
      res.send(response);
    } else {
      var reply = function(value: any){
        //send the response as json encoded into image if there wasnt a textResponse parameter
        let resultPath = path.join(__dirname, v4()+".png"); //generate a uuid for the image
        //encode will convert our json object response into a string into a image
        encode(JSON.stringify(value), resultPath, ()=>{
          //send file to user
          res.sendFile(resultPath, {}, function(){
            fs.unlink(resultPath,a=>{}) //delete image
          })
        })        
      }
      if (mode === "bulk") {
        storage.reply(query, response, options, reply)
      } else if (mode === "secure") {
        reply(response)
      }
    }
  }
}

class InterfaceUser {

}

//generated from registerInterface
//an interface is similar to a connection, but does not require "keep alive" and stuff
//in other words, everything is static
class InterfacePort {
  path: string
  callbacks: {[s: string]: Function}
  users: {[s: string]: InterfaceUser}

  constructor(methodpath: string, callbacks: {[s: string]: Function}){
    this.path = methodpath;
    this.callbacks = callbacks;
    this.users = {}
  }
  get(query: Query, reply: Function, special: {req: express.Request, res: express.Response}){

    if (!this.users[query.$id]) {
      this.users[query.$id] = new InterfaceUser()
    }

    const user = this.users[query.$id];
    const callback = this.callbacks[query.$method];
    if (callback) {
      callback.call(user, query, reply, special)
    }
  }
}

//generated from registerConnection
//a connection is a two way "connection" between the server and client. the client must constantly update to be able to receive responses from the server
class ConnectionPort {
  connections: {[s: string]: Connection}
  path: string
  connectionClass: typeof Connection

  constructor(methodpath: string, connectionClass: typeof Connection){
    this.connections = {}
    this.path = methodpath;
    this.connectionClass = connectionClass;
  }
  getconnections(): Connection[] {
    return Object.keys(this.connections).map(key=>this.connections[key]);
  }
  get(query: Query, reply: Function, special: {req: express.Request, res: express.Response}){
    let connection: Connection;

    switch (query.$method) {
      case "update":
        connection = this.connections[query.$connectionid]
        if (connection) {
          connection._update(query, reply /*, special*/);
        } else if (query.$connectionid){
          reply({$status:"error", error:"connectionid is either invalid or expired."})
        } else {
          new this.connectionClass({
            port: this,
            gameid: query.$gameid,
            userid: query.$userid,
            timestamp: query.$timestamp,
            id: query.$id,
            connectionid: v4() as string,
            req: special.req,
            res: special.res,
            receive: function(c: Connection){
              connection = c;
            }
          }, query, function(response: {[s: string]: any}, options: ReplyOptions){
            response.$connectionid = connection.connectionid;
            connection._transform(response)
            reply(response, options)
          });
        }
        break;

      case "close":
        connection = this.connections[query.$id]
        if (connection) {
          let success = connection.close(query);
          reply({$status:"closed",$success:success})
        } else {
          reply({$status:"error"});
        }
        break;
      
      case "custom":
        connection = this.connections[query.$id]
        if (connection) {
          
        } else {
          reply({$status:"error"});
        }
        break;
      
      default:
        reply({$status:"error"})  
    }
  }
}


//generated for each user connected to a connection
interface ConnectionProps {receive?: (c:Connection)=>void, id: string, gameid: string, userid: string, timestamp: string, timeout?: number, port: ConnectionPort, req: express.Request, res:express.Response, connectionid: string}
class Connection implements ConnectionProps {
  alive: boolean = true
  id: string
  gameid: string
  userid: string
  timestamp: string
  timeout: number
  port: ConnectionPort
  req: express.Request
  res:express.Response
  connectionid: string
  last: number
  eventsQueue: any[] = []
  room?: string
  willClose: boolean = false

  constructor(props: ConnectionProps, query: Query, callback: Function){
    //this.fired = new Function;

    this.id = props.id;
    this.gameid = props.gameid;
    this.userid = props.userid;
    this.timestamp = props.timestamp;
    this.timeout = props.timeout || 10000;
    this.port = props.port;
    this.req = props.req;
    this.res = props.res;
    this.connectionid = props.connectionid;

    this.last = Date.now();

    this.checkTimeout();
    this.port.connections[this.connectionid] = this;
    props.receive&&props.receive(this);
  }
  onclose(msg?: any){

  }
  update(query: Query, reply: Function){
    reply({$status: "unset"})
  }
  getUsersInRoom(room: string){
    return this.port.getconnections().filter(e=>e.room===room);
  }
  isExpired(){
    return this.last-Date.now() > this.timeout;
  }
  checkTimeout(){
    console.log("Timeout", this.timeout);
    setTimeout(()=>{
      console.log("Checking Timeout", Date.now()-this.last, this.timeout);
      if (Date.now()-this.last >= this.timeout) {
        console.log("Closing");
        this.close();
      }
    }, this.timeout+500)    
  }
  getconnections(){
    return this.port.getconnections();
  }
  closeAfterLastMessage(){
    if (this.alive) {
      this.willClose = true;
    }
  }
  close(msg?: any){
    if (this.alive) {
      this.alive = false;
      this.onclose(msg);
      delete this.port.connections[this.connectionid];
      return true;
    } else {
      return false;
    }
  }
  _transform(response: {}){
    if (this.eventsQueue.length) {
      Object.assign(response, {$events:this.eventsQueue})
      this.eventsQueue = [];
    }
  }

  _update(query: Query, reply: Function){
    if (this.willClose){
      let response = {} as {[s: string]: any}
      this._transform(response);
      response.$closing = true;
      this.close();
      reply(response)
      return;
    }
    this.last = Date.now();
    this.checkTimeout();
    this.update(query, (response: any, options: ReplyOptions)=>{
      this._transform(response);
      reply(response, options)
    })
  }
  send(message: any){
    if (!this.alive){
      throw new Error("connection is dead")
    }
    this.eventsQueue.push(message);
  }

}



module.exports = {
  baseConnection: Connection,
  setExpressInstance: function(expi: express.Express){
    expressInstance = expi
  },
  expressInstance: ()=>expressInstance,
  init: function(){
    expressInstance.listen(PORT, () => console.log(`Listening on ${ PORT }`));
  },
  registerMethod: function(methodpath: string, callback: Function){
    expressInstance.get(methodpath, function(req, res){
      const query = transformQuery(req.query);
      const reply = generateReplyFunction(query, res);
      callback(query, reply, {req,res})
    })
  },
  registerInterface: function(methodpath: string, callbacks: {[s: string]: Function}){
    const port = new InterfacePort(methodpath, callbacks);
    
    expressInstance.get(methodpath, function(req, res){
      const query = transformQuery(req.query);
      const reply = generateReplyFunction(query, res);
      port.get(query, reply, {req,res})
    })
    return port;
  },

  registerConnection: function(methodpath: string, connectionClass: typeof Connection){
    const port = new ConnectionPort(methodpath, connectionClass);
    
    expressInstance.get(methodpath, function(req, res){
      const query = transformQuery(req.query);
      const reply = generateReplyFunction(query, res);
      port.get(query, reply, {req,res})
    })

    return port;
  }
}
