import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd(), rawDir = path.join(root, 'tools/imgout');
const iconDir = path.join(root, 'public/icons/pixel'), outDir = path.join(root, 'tools/pixelout');
const names = ['tab_base', 'tab_people', 'tab_map', 'tab_laws', 'tab_log'];
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable = new Uint32Array(256);
for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d=Buffer.alloc(0)){const tb=Buffer.from(t),body=Buffer.concat([tb,d]),o=Buffer.alloc(12+d.length);o.writeUInt32BE(d.length);body.copy(o,4);o.writeUInt32BE(crc32(body),8+d.length);return o;}
function encode(w,h,rgba){const stride=w*4,raw=Buffer.alloc((stride+1)*h);for(let y=0;y<h;y++)rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND')]);}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decode(buf){if(!buf.subarray(0,8).equals(sig))throw Error('Invalid PNG');let w,h,depth,type,interlace,pos=8;const ids=[];while(pos<buf.length){const len=buf.readUInt32BE(pos),t=buf.toString('ascii',pos+4,pos+8),s=pos+8,e=s+len;if(t==='IHDR'){w=buf.readUInt32BE(s);h=buf.readUInt32BE(s+4);depth=buf[s+8];type=buf[s+9];interlace=buf[s+12];}if(t==='IDAT')ids.push(buf.subarray(s,e));pos=e+4;if(t==='IEND')break;}if(depth!==8||type!==6||interlace!==0)throw Error(`Unsupported PNG ${depth}/${type}/${interlace}`);const stride=w*4,packed=zlib.inflateSync(Buffer.concat(ids)),data=Buffer.alloc(stride*h);for(let y=0;y<h;y++){const f=packed[y*(stride+1)],row=y*stride,src=y*(stride+1)+1;for(let x=0;x<stride;x++){const l=x>=4?data[row+x-4]:0,u=y?data[row+x-stride]:0,ul=y&&x>=4?data[row+x-stride-4]:0;let p=0;if(f===1)p=l;else if(f===2)p=u;else if(f===3)p=Math.floor((l+u)/2);else if(f===4)p=paeth(l,u,ul);else if(f!==0)throw Error(`Unsupported filter ${f}`);data[row+x]=(packed[src+x]+p)&255;}}return{w,h,data};}
function makeCell(img,name){let minX=img.w,minY=img.h,maxX=-1,maxY=-1;for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const i=(y*img.w+x)*4;if(img.data[i+3]<64)img.data[i+3]=0;else{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}if(maxX<0)throw Error(`${name}: no visible pixels`);const cw=maxX-minX+1,ch=maxY-minY+1,fit=42/Math.max(cw,ch),dw=Math.max(1,Math.floor(cw*fit)),dh=Math.max(1,Math.floor(ch*fit)),x0=Math.floor((48-dw)/2),y0=Math.floor((48-dh)/2),cell=Buffer.alloc(48*48*4);for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const si=((minY+Math.floor(y*ch/dh))*img.w+minX+Math.floor(x*cw/dw))*4;if(img.data[si+3]>=64)img.data.copy(cell,((y+y0)*48+x+x0)*4,si,si+4);}return cell;}

fs.mkdirSync(iconDir,{recursive:true});fs.mkdirSync(outDir,{recursive:true});
const cellSize=48,gutter=8,sheetW=5*48+4*8,sheetH=48,sheet=Buffer.alloc(sheetW*sheetH*4),entries=[];
for(let col=0;col<names.length;col++){const name=names[col],cell=makeCell(decode(fs.readFileSync(path.join(rawDir,`${name}.png`))),name);fs.writeFileSync(path.join(iconDir,`${name}.png`),encode(48,48,cell));for(let y=0;y<48;y++)cell.copy(sheet,(y*sheetW+col*(48+gutter))*4,y*48*4,(y+1)*48*4);entries.push({name,sheet:'sheet-03.png',row:0,col,file:`public/icons/pixel/${name}.png`});}
fs.writeFileSync(path.join(outDir,'sheet-03.png'),encode(sheetW,sheetH,sheet));
const manifestPath=path.join(outDir,'smanifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest.push(...entries);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
for(const name of names){const {w,h,data}=decode(fs.readFileSync(path.join(iconDir,`${name}.png`)));if(w!==48||h!==48)throw Error(`${name}: incorrect dimensions`);for(const [x,y] of [[0,0],[47,0],[0,47],[47,47]])if(data[(y*48+x)*4+3]!==0)throw Error(`${name}: corner is not transparent`);if(!data.some((v,i)=>i%4===3&&v>0))throw Error(`${name}: no visible pixels`);}
console.log(`Wrote ${names.length} 48x48 tab icons and tools/pixelout/sheet-03.png; validated dimensions, corners, and visible pixels.`);
