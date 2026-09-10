const fs=require("fs");const W=900,X0=83,Y0=56,BW=786,N=112;
const BX0=46,BX1=101,BY0=26,BY1=95;
function alphaOf(b){const d=[];for(let k=0;k<b.length;k+=3){const dd=b[k]-b[k+1];if(dd>4)d.push(dd);}
 if(!d.length)return 0; d.sort((a,c)=>a-c); return d[Math.floor(d.length/2)]/255;}
let ALPHA=0;
function load(f){const b=fs.readFileSync(f); ALPHA=alphaOf(b); console.error("  alpha("+f+")="+ALPHA.toFixed(3));const g=new Float64Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){let s=0,n=0;
  const xa=Math.round(X0+i*BW/N),xb=Math.round(X0+(i+1)*BW/N);
  const ya=Math.round(Y0+j*BW/N),yb=Math.round(Y0+(j+1)*BW/N);
  for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){const o=(y*W+x)*3,R=b[o],G=b[o+1];
   let v=(R>G+2)?G/(1-ALPHA):G; s+=Math.min(255,v);n++;}
  g[j*N+i]=s/n;} return g;}
// 3x3 median-ish blur
function blur(g){const o=new Float64Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){let s=0,n=0;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const y=j+dj,x=i+di;
   if(y>=0&&y<N&&x>=0&&x<N){s+=g[y*N+x];n++;}} o[j*N+i]=s/n;} return o;}
function grow(g,si,sj,T){const m=new Uint8Array(N*N),st=[[si,sj]];m[sj*N+si]=1;let c=1;
 while(st.length){const [i,j]=st.pop();
  for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=i+di,y=j+dj;
   if(x<BX0||y<BY0||x>BX1||y>BY1)continue; const k=y*N+x;
   if(m[k])continue; if(g[k]<T){m[k]=1;c++;st.push([x,y]);}}}
 return {m,c};}
function close(m,r){ // dilate then erode
 const d=new Uint8Array(N*N),e=new Uint8Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){let any=0;
  for(let dj=-r;dj<=r&&!any;dj++)for(let di=-r;di<=r;di++){const y=j+dj,x=i+di;
   if(y>=0&&y<N&&x>=0&&x<N&&m[y*N+x]){any=1;break;}} d[j*N+i]=any;}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){let all=1;
  for(let dj=-r;dj<=r&&all;dj++)for(let di=-r;di<=r;di++){const y=j+dj,x=i+di;
   if(y<0||y>=N||x<0||x>=N||!d[y*N+x]){all=0;break;}} e[j*N+i]=all;}
 return e;}
// radial boundary trace from centroid -> naturally ordered, smooth
function contour(m){let sx=0,sy=0,n=0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(m[j*N+i]){sx+=i;sy+=j;n++;}
 const cx=sx/n, cy=sy/n, K=96, pts=[];
 for(let a=0;a<K;a++){const th=a/K*Math.PI*2, dx=Math.cos(th), dy=Math.sin(th);
  let r=0; for(let t=0.5;t<80;t+=0.5){const x=Math.round(cx+dx*t), y=Math.round(cy+dy*t);
   if(x<0||y<0||x>=N||y>=N||!m[y*N+x])break; r=t;}
  pts.push([cx+dx*r, cy+dy*r]);}
 // circular smoothing
 const sm=pts.map((_,k)=>{let x=0,y=0;for(let d=-3;d<=3;d++){const p=pts[(k+d+K)%K];x+=p[0];y+=p[1];}return [x/7,y/7];});
 return {pts:sm,cx,cy,area:n};}
function toPath(p){ // closed catmull-rom -> cubic bezier
 const K=p.length; let d=`M${p[0][0].toFixed(2)},${p[0][1].toFixed(2)}`;
 for(let k=0;k<K;k++){const p0=p[(k-1+K)%K],p1=p[k],p2=p[(k+1)%K],p3=p[(k+2)%K];
  const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6];
  const c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
  d+=`C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;}
 return d+"Z";}
const out={};
for(const f of ["00","15","30"]){
 const g=blur(load("f"+f+".rgb"));
 let best=null;
 for(const T of [40,46,52,58,64]) for(const [si,sj] of [[70,55],[72,62],[68,48],[74,70],[66,60],[78,58],[70,78]]){
  if(g[sj*N+si]>=T) continue;
  const {m,c}=grow(g,si,sj,T);
  if(c<400||c>3600) continue;
  if(!best||Math.abs(c-2200)<Math.abs(best.c-2200)) best={m,c,T,si,sj};}
 if(!best){console.log("frame",f,"NO BLOB");continue;}
 const m=close(best.m,2), C=contour(m);
 out[f]={path:toPath(C.pts),area:C.area,T:best.T,seed:[best.si,best.sj],raw:best.c};
 console.log("frame",f,"T="+best.T,"seed="+best.si+","+best.sj,"raw="+best.c,"closed="+C.area,"centroid="+C.cx.toFixed(1)+","+C.cy.toFixed(1));}
fs.writeFileSync("contours.json",JSON.stringify(out,null,1));
