import Jimp from "jimp";

function remove_non_ascii(str: string) {

  if ((str===null) || (str===''))
       return '';
 else
   str = str.toString();

  return str.replace(/[^\x20-\x7E]/g, '');
}

export default function(str: string, name: string, callback: Function) {
  str = remove_non_ascii(str)
  str += "\0".repeat((2 - (str.length % 2)) % 2) //add null characters at the end of string
  let current = [];
  let list: number[] = []
  for (var i = 0; i<str.length; i++) {
    let numtoencode = str.charCodeAt(i)
    let a = (numtoencode)%16;
    let b = (numtoencode-(a))/16;
    current.push(b*16);
    current.push(a*16);
    if (i%2===1) {
      if (current[3]===0) current[3] = 255
      var bigint = Jimp.rgbaToInt.apply(null, current as [number, number, number, number])
      list.push(bigint)
      current = []
    }
  }
  let image = new Jimp(list.length, 1, function(err: Error, image: Jimp){ //any because im too lazy and this isn't some api it just uses jimp so it doesnt matter
    if (err) throw err;
    list.forEach((color, x) => {
        image.setPixelColor(color, x, 0);
    });
    //i literally dont care at this point
    image.write(name, (err: Error | any)=>{
      if (err) throw err
      else callback(image)
    })
  })
}
