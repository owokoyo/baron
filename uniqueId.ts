const ids: {[s: string]: string} = {};
const idlookup: {[s: string]: {gameid: string, userid: string, timestamp: string}} = {};

import {v4} from "uuid"

export default function(gameid: string, userid: string, timestamp: string){
  var idString = `${gameid}/${userid}/${timestamp}`;
  if (!ids[idString]) {
    ids[idString] = v4();
  } else {
    idlookup[ids[idString]] = {
      gameid: gameid,
      userid: userid,
      timestamp: timestamp
    }
  }
  return ids[idString]
}
