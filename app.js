import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/* ================= Utilitaires & réglages ================= */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const DEF={vol:.8,sfx:.8,win:3,likes:2,lkB:2,lkBn:1,lkM:2,lkMn:50,lkF:2,lkFn:10,q:'med',sens:1,url:'ws://127.0.0.1:21213/',auto:0};
const S=(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem('tl_set')||'{}')}}catch{return {...DEF}}})();
const save=()=>{try{localStorage.setItem('tl_set',JSON.stringify(S))}catch{}};
const QUAL={low:{pr:1,cap:4000,sh:false,pt:300},med:{pr:1.5,cap:10000,sh:false,pt:700},high:{pr:2,cap:20000,sh:true,pt:1400}};
const COLN=[0,0x2f7bff,0x2ed36a,0xff3040],COLH=['','#2f7bff','#2ed36a','#ff3040'];
const M={down:false},K={},rc=new THREE.Raycaster(),V3=(x,y,z)=>new THREE.Vector3(x,y,z);

/* m=billes/unité (jeu 1), k=bombes/unité (jeu 2, red=bombes rouges) ; jeu 3 : k×5 fruits ; w=WIN (les 3 jeux) */
const GIFTS=[
 {n:'Rose',re:/\brose\b/,m:50,k:2,red:1},{n:'GG',re:/\bgg\b/,m:-50,k:2},
 {n:'Capybara',re:/capybara/,m:-1500,k:60},{n:'Doughnut',re:/dou?ghnut|donut|beignet/,m:1500,k:60},
 {n:'Ourson',re:/ourson|teddy|bear/,m:-5000,k:200},{n:'Cœur dans les mains',re:/hand|mains/,m:5000,k:200},
 {n:'Cœur',re:/heart|coeur/,m:10000,k:400},{n:'Lunettes de soleil',re:/sunglass|lunette/,m:-10000,k:400},
 {n:'Money Gun',re:/money/,w:-1},{n:'Trophée',re:/troph/,w:1},{n:'Galaxy',re:/galax/,w:5},{n:'Girafe',re:/girafe|giraffe/,w:-5}];
const findGift=n=>{n=String(n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return GIFTS.find(g=>g.re.test(n))};

/* ================= Sons (WebAudio synthétisé) ================= */
const Snd={c:null,
 init(){if(this.c)return;try{const c=this.c=new(window.AudioContext||window.webkitAudioContext)();this.m=c.createGain();this.e=c.createGain();this.e.connect(this.m);this.m.connect(c.destination);
  const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=b;
  const s=c.createBufferSource();s.buffer=b;s.loop=true;this.f=c.createBiquadFilter();this.f.type='bandpass';this.f.frequency.value=300;this.vg=c.createGain();this.vg.gain.value=0;
  s.connect(this.f);this.f.connect(this.vg);this.vg.connect(this.e);s.start();this.vol()}catch(e){console.warn('Audio indisponible',e)}},
 vol(){if(!this.c)return;this.m.gain.value=S.vol;this.e.gain.value=S.sfx},
 vac(on){if(!this.c)return;const t=this.c.currentTime;this.vg.gain.setTargetAtTime(on?.9:0,t,.08);this.f.frequency.setTargetAtTime(on?750:300,t,.3)},
 tone(a,b,d,ty='sine',g=.4){if(!this.c)return;const c=this.c,o=c.createOscillator(),n=c.createGain(),t=c.currentTime;o.type=ty;o.frequency.setValueAtTime(a,t);o.frequency.exponentialRampToValueAtTime(b,t+d);n.gain.setValueAtTime(g,t);n.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(n);n.connect(this.e);o.start(t);o.stop(t+d)},
 noise(d,g,fc){if(!this.c)return;const c=this.c,s=c.createBufferSource(),f=c.createBiquadFilter(),n=c.createGain(),t=c.currentTime;s.buffer=this.nb;f.type='lowpass';f.frequency.value=fc;n.gain.setValueAtTime(g,t);n.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f);f.connect(n);n.connect(this.e);s.start(t);s.stop(t+d)},
 pop(){this.tone(520,170,.13,'sine',.6)},boom(){this.noise(.7,.9,350);this.tone(130,35,.5,'sine',.7)},
 chime(){this.tone(660,990,.25,'triangle',.35)},tick(){this.tone(880,880,.08,'square',.12)}};

/* ================= Particules (disques ronds) ================= */
const DOT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.8,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
class Particles{
 constructor(scene,n){this.n=n;this.i=0;this.p=new Float32Array(n*3).fill(-999);this.v=new Float32Array(n*3);this.l=new Float32Array(n);this.col=new Float32Array(n*3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.p,3));g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
  this.o=new THREE.Points(g,new THREE.PointsMaterial({size:.22,map:DOT,alphaTest:.25,vertexColors:true,transparent:true,depthWrite:false}));this.o.frustumCulled=false;scene.add(this.o)}
 put(x,y,z,vx,vy,vz,C,l){const i=this.i=(this.i+1)%this.n,j=i*3;this.p[j]=x;this.p[j+1]=y;this.p[j+2]=z;this.v[j]=vx;this.v[j+1]=vy;this.v[j+2]=vz;this.l[i]=l;this.col[j]=C.r;this.col[j+1]=C.g;this.col[j+2]=C.b}
 emit(x,y,z,c,n,sp,up=0){const C=new THREE.Color(c);for(let k=0;k<n;k++){const a=rnd(0,6.283),e=rnd(-.2,1),s=rnd(.3,1)*sp;this.put(x,y,z,Math.cos(a)*s,e*s+up,Math.sin(a)*s,C,rnd(.5,1.2))}}
 flow(a,b,c){this.put(a.x,a.y,a.z,(b.x-a.x)*4,(b.y-a.y)*4+2,(b.z-a.z)*4,new THREE.Color(c),.25)}
 update(dt){for(let i=0;i<this.n;i++){if(this.l[i]<=0)continue;const j=i*3;this.l[i]-=dt;if(this.l[i]<=0){this.p[j+1]=-999;continue}
  this.v[j+1]-=9*dt;this.p[j]+=this.v[j]*dt;this.p[j+1]+=this.v[j+1]*dt;this.p[j+2]+=this.v[j+2]*dt}
  const a=this.o.geometry.attributes;a.position.needsUpdate=a.color.needsUpdate=true}}

const mk=(geo,col,x,y,z,o={})=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:o.r??.9,metalness:o.m??0,emissive:o.e??0,side:o.side??THREE.FrontSide}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m};
const box=(w,h,d,x,y,z,c,ry=0)=>{const m=mk(new THREE.BoxGeometry(w,h,d),c,x,y,z);m.rotation.y=ry;return m};
function baseScene(q,sky,ext){const sc=new THREE.Scene();sc.background=new THREE.Color(sky);sc.fog=new THREE.Fog(sky,120,380);sc.environment=App.env;
 sc.add(new THREE.HemisphereLight(0xffffff,0x6a7a5a,.75));const sun=new THREE.DirectionalLight(0xfff1d6,2.4);sun.position.set(ext*.6,ext*1.1,ext*.4);
 if(q.sh){sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,far:ext*4});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0006}sc.add(sun);return sc}
function disposeScene(sc){sc.traverse(o=>{o.geometry?.dispose();const m=o.material;(Array.isArray(m)?m:[m]).forEach(x=>{if(x){x.map?.dispose();x.dispose()}})})}
const rod=(a,b,r,mat)=>{const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),14),mat);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize());return m};

/* ================= Joueur en première personne (avec ragdoll + poussée) ================= */
class FPS{
 constructor(cam,x,y,z,yaw,w){this.cam=cam;this.p=V3(x,y,z);this.yaw=yaw;this.pitch=0;this.vy=0;this.on=false;this.v=new THREE.Vector2();this.w=w;this.bob=0;this.spd=6.5;this.ac=14;this.gv=22;this.jp=8;this.co=0;
  this.rag=this.rt=this.kx=this.kz=this.inv=0;cam.rotation.order='YXZ'}
 /* ragdoll(durée) : ignoré si déjà en ragdoll (pas de prolongation) ; force=true ignore l'immunité post-ragdoll */
 ragdoll(sec,force){if(this.rag>0)return false;if(!force&&this.inv>0)return false;this.rag=this.rt=sec;this.vy=Math.max(this.vy,3);return true}
 update(dt){const p=this.p;if(this.rag>0){this.rag-=dt;if(this.rag<=0){this.rag=0;this.inv=1.5;this.pitch=0}}this.inv=Math.max(0,this.inv-dt);
  const KK=this.rag>0?{}:K,f=(KK.KeyW?1:0)-(KK.KeyS?1:0),s=(KK.KeyD?1:0)-(KK.KeyA?1:0),sy=Math.sin(this.yaw),cy=Math.cos(this.yaw);
  let wx=-sy*f+cy*s,wz=-cy*f-sy*s;const l=Math.hypot(wx,wz)||1;const mv=Math.min(1,Math.abs(f)+Math.abs(s))*this.spd;wx=wx/l*mv;wz=wz/l*mv;
  const a=Math.min(1,dt*(this.on?this.ac:this.ac*.45));this.v.x+=(wx-this.v.x)*a;this.v.y+=(wz-this.v.y)*a;
  let nx=p.x+(this.v.x+this.kx)*dt,nz=p.z+(this.v.y+this.kz)*dt;
  if(this.w.block(nx,p.z,p.y,p.x,p.z)){nx=p.x;this.v.x=0}if(this.w.block(nx,nz,p.y,nx,p.z)){nz=p.z;this.v.y=0}
  this.bob+=Math.hypot(this.v.x,this.v.y)*dt*1.7;p.x=nx;p.z=nz;this.kx*=Math.max(0,1-3*dt);this.kz*=Math.max(0,1-3*dt);
  this.co=this.on?.12:Math.max(0,this.co-dt);if(KK.Space&&this.co>0){this.vy=this.jp;this.on=false;this.co=0}this.vy-=this.gv*dt;p.y+=this.vy*dt;const g=this.w.ground(p.x,p.z,p.y);if(p.y<=g){p.y=g;this.vy=0;this.on=true}else if(p.y>g+.05)this.on=false;
  this.w.clamp?.(this);
  {const u=this.rag>0?ease(Math.min((this.rt-this.rag)/.3,this.rag/.4,1)):0,tt=this.rt-this.rag;
   this.cam.position.set(p.x,p.y+1.7-1.2*u+(this.on&&!u?Math.sin(this.bob)*.035:0),p.z);
   this.cam.rotation.set(this.pitch*(1-u)+u*.6,this.yaw,u*(1.2+.4*Math.sin(tt*6)))}}}

/* ===== FIN PARTIE 1/4 — la partie 2 (modèles 3D, jeu 1) continue juste après ===== */

/* ================= Modèles 3D tenus en main ================= */
function vacModel(){const g=new THREE.Group(),
 red=new THREE.MeshPhysicalMaterial({color:0xd01f2b,metalness:.45,roughness:.25,clearcoat:1,clearcoatRoughness:.1}),
 steel=new THREE.MeshStandardMaterial({color:0xcfd5db,metalness:.95,roughness:.22}),
 dark=new THREE.MeshStandardMaterial({color:0x1a1d21,roughness:.55,metalness:.3}),
 yel=new THREE.MeshStandardMaterial({color:0xffc83d,roughness:.4,emissive:0x442b00}),
 glass=new THREE.MeshPhysicalMaterial({color:0x99ccee,transparent:true,opacity:.4,roughness:.05}),
 add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m},P=Math.PI/2;
 add(new THREE.CapsuleGeometry(.12,.34,6,18),red,.2,-.36,-.38,P);
 add(new THREE.CylinderGeometry(.1,.1,.05,20),dark,.2,-.245,-.36);add(new THREE.CylinderGeometry(.03,.03,.03,12),yel,.2,-.225,-.3);add(new THREE.BoxGeometry(.09,.015,.12),glass,.2,-.245,-.45);
 for(const[x,z]of[[.07,-.26],[.33,-.26],[.07,-.5],[.33,-.5]])add(new THREE.CylinderGeometry(.055,.055,.03,16),dark,x,-.44,z,0,0,P);
 add(new THREE.CylinderGeometry(.045,.05,.1,16),dark,.2,-.36,-.64,P);
 const hose=new THREE.CatmullRomCurve3([V3(.2,-.36,-.68),V3(.3,-.44,-.86),V3(.14,-.46,-.98),V3(.02,-.3,-.92),V3(.04,-.2,-.94)]);add(new THREE.TubeGeometry(hose,36,.022,8),dark,0,0,0);
 g.add(rod(V3(.04,-.2,-.9),V3(.05,-.23,-1.06),.028,yel));g.add(rod(V3(.05,-.22,-1.0),V3(.06,-.35,-1.52),.016,steel));
 const d=V3(0,-.3,-1).normalize(),nz=V3(.06,-.37,-1.56),nq=new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),d.clone().negate());
 const head=add(new THREE.CylinderGeometry(.05,.13,.1,22,1,true),red,nz.x,nz.y,nz.z);head.quaternion.copy(nq);head.material.side=THREE.DoubleSide;
 const rim=add(new THREE.TorusGeometry(.13,.012,8,24),yel,nz.x,nz.y,nz.z);rim.position.addScaledVector(d,.05);rim.quaternion.setFromUnitVectors(V3(0,0,1),d);
 const brush=add(new THREE.CylinderGeometry(.018,.018,.22,10),dark,nz.x,nz.y,nz.z);brush.position.addScaledVector(d,.03);brush.rotation.z=P;
 g.traverse(o=>{o.castShadow=false});return{g,tip:nz.clone().addScaledVector(d,.1),brush,base:V3(0,0,0)}}

/* Pistolet à peinture (jeu 2) : silhouette extrudée, réservoir transparent, canon à manchon, viseur point rouge, gant + manche.
   Interface : {g, muzzle, anim(recul, flash, temps, fps, gâchette)} */
function paintGun(col){
 const g=new THREE.Group(),root=new THREE.Group(),C=COLN[col],P=Math.PI/2;g.add(root);
 const PM=o=>new THREE.MeshPhysicalMaterial(o),SM=o=>new THREE.MeshStandardMaterial(o),
 body=PM({color:0x20252b,metalness:.75,roughness:.3,clearcoat:.8,clearcoatRoughness:.18}),
 steel=SM({color:0xd3d9de,metalness:.95,roughness:.2}),
 rubber=SM({color:0x101215,roughness:.95}),
 paint=SM({color:C,emissive:C,emissiveIntensity:.35,roughness:.3,metalness:.2}),
 ledM=SM({color:C,emissive:C,emissiveIntensity:.6,roughness:.3}),
 glass=PM({color:0xffffff,transparent:true,opacity:.22,roughness:.03,clearcoat:1,depthWrite:false}),
 liq=PM({color:C,emissive:C,emissiveIntensity:.35,roughness:.18,clearcoat:1}),
 glove=SM({color:0x15181c,roughness:.85}),sleeve=SM({color:0x2c3644,roughness:.9}),
 sightGlass=new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}),
 add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,p=root)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);p.add(m);return m},
 /* extrusion d'un profil latéral (x du profil = avant du pistolet, y = haut) */
 ext=(sh,d,b,mat,x=0,y=0,z=0,p=root)=>{const geo=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:12});geo.translate(0,0,-d/2);return add(geo,mat,x,y,z,0,P,0,p)};

 /* carcasse */
 const rs=new THREE.Shape();rs.moveTo(0,-.04);rs.quadraticCurveTo(-.02,.05,.08,.085);rs.lineTo(.36,.09);rs.quadraticCurveTo(.5,.095,.58,.06);rs.lineTo(.62,0);rs.quadraticCurveTo(.63,-.06,.56,-.075);rs.lineTo(.2,-.08);rs.quadraticCurveTo(.05,-.085,0,-.04);
 ext(rs,.07,.014,body);
 const ps=new THREE.Shape();ps.moveTo(.1,.045);ps.lineTo(.4,.06);ps.lineTo(.5,.025);ps.lineTo(.47,-.035);ps.lineTo(.14,-.045);ps.closePath();
 for(const s of[-1,1])ext(ps,.004,.005,paint,s*.0475);
 /* bandes lumineuses (pulsent au tir) */
 for(const s of[-1,1])add(new THREE.BoxGeometry(.004,.01,.22),ledM,s*.0555,-.02,-.29);

 /* poignée + sabots antidérapants */
 const gs=new THREE.Shape();gs.moveTo(.09,-.05);gs.lineTo(.29,-.05);gs.quadraticCurveTo(.26,-.17,.21,-.28);gs.quadraticCurveTo(.2,-.31,.17,-.31);gs.lineTo(.07,-.31);gs.quadraticCurveTo(.03,-.31,.04,-.27);gs.quadraticCurveTo(.07,-.15,.09,-.05);
 ext(gs,.05,.012,rubber);
 for(let k=0;k<5;k++){const t=.12+k*.17,xs=.29-.08*t*1.0-.005,y=-.05-.23*t;add(new THREE.BoxGeometry(.082,.006,.022),steel,0,y,-xs,.3,0,0)}
 add(new THREE.CylinderGeometry(.045,.04,.02,20),paint,0,-.315,-.12,0,0,0);

 /* pontet + détente */
 add(new THREE.TorusGeometry(.07,.008,8,24,Math.PI),steel,0,-.07,-.36,0,P,Math.PI);
 const trig=new THREE.Group();trig.position.set(0,-.07,-.34);root.add(trig);
 const ts=new THREE.Shape();ts.moveTo(.012,0);ts.lineTo(-.012,0);ts.quadraticCurveTo(-.012,-.04,-.03,-.065);ts.lineTo(-.012,-.075);ts.quadraticCurveTo(.012,-.04,.012,0);
 ext(ts,.014,.003,paint,0,0,0,trig);

 /* canon : tube, manchon nervuré, évents, bouche */
 const bar=new THREE.Group();bar.position.set(0,.03,0);root.add(bar);
 add(new THREE.CylinderGeometry(.016,.016,.8,16),steel,0,0,-.95,P,0,0,bar);
 add(new THREE.CylinderGeometry(.03,.034,.4,24),body,0,0,-.78,P,0,0,bar);
 for(let k=0;k<7;k++)add(new THREE.TorusGeometry(.0335,.0045,8,24),steel,0,0,-(.6+k*.055),0,0,0,bar);
 for(let k=0;k<5;k++)for(const a of[-1,1,3.14])add(new THREE.CapsuleGeometry(.006,.035,4,8),rubber,Math.sin(a)*.0315,Math.cos(a)*.0315,-(.65+k*.065),P,0,0,bar);
 add(new THREE.CylinderGeometry(.03,.027,.13,22),body,0,0,-1.26,P,0,0,bar);
 add(new THREE.TorusGeometry(.03,.007,8,22),paint,0,0,-1.31,0,0,0,bar);
 const bore=add(new THREE.CircleGeometry(.014,16),rubber,0,0,-1.328,0,Math.PI,0,bar);
 add(new THREE.CylinderGeometry(.004,.006,.035,8),steel,0,.047,-1.24,0,0,0,bar);

 /* pompe coulissante (recule au tir) */
 const slide=new THREE.Group();slide.position.set(0,.03,0);root.add(slide);
 add(new THREE.CylinderGeometry(.042,.042,.16,26),body,0,0,-.8,P,0,0,slide);
 for(let k=0;k<5;k++)add(new THREE.TorusGeometry(.0435,.006,8,26),rubber,0,0,-(.74+k*.03),0,0,0,slide);
 add(new THREE.TorusGeometry(.043,.005,8,26),paint,0,0,-.715,0,0,0,slide);add(new THREE.TorusGeometry(.043,.005,8,26),paint,0,0,-.885,0,0,0,slide);

 /* bouteille d'air sous le canon */
 add(new THREE.CapsuleGeometry(.032,.34,6,16),body,0,-.118,-.66,P,0,0);
 add(new THREE.TorusGeometry(.0335,.0065,8,22),paint,0,-.118,-.53,0,0,0);add(new THREE.TorusGeometry(.0335,.0065,8,22),paint,0,-.118,-.8,0,0,0);
 add(new THREE.CylinderGeometry(.012,.012,.04,10),steel,0,-.118,-.9,P,0,0);

 /* réservoir de peinture transparent */
 const tk=new THREE.Group();tk.position.set(0,0,-.2);root.add(tk);
 add(new THREE.CylinderGeometry(.03,.04,.05,20),body,0,.11,0,0,0,0,tk);
 add(new THREE.TorusGeometry(.043,.007,8,22),steel,0,.135,0,P,0,0,tk);
 add(new THREE.CapsuleGeometry(.07,.11,8,22),glass,0,.25,0,0,0,0,tk);
 const lq=add(new THREE.CapsuleGeometry(.058,.06,8,20),liq,0,.22,0,0,0,0,tk);
 add(new THREE.CylinderGeometry(.034,.034,.025,20),steel,0,.385,0,0,0,0,tk);
 add(new THREE.TorusGeometry(.035,.006,8,20),paint,0,.372,0,P,0,0,tk);

 /* rail + viseur point rouge */
 add(new THREE.BoxGeometry(.03,.012,.2),body,0,.094,-.52);
 add(new THREE.BoxGeometry(.034,.012,.07),body,0,.104,-.5);
 for(const s of[-1,1])add(new THREE.BoxGeometry(.008,.04,.01),body,s*.028,.125,-.5);
 add(new THREE.TorusGeometry(.032,.005,8,24),body,0,.15,-.5);
 add(new THREE.CircleGeometry(.029,22),sightGlass,0,.15,-.5);
 add(new THREE.SphereGeometry(.004,8,6),new THREE.MeshBasicMaterial({color:0xff2030}),0,.15,-.497);

 /* main gantée + avant-bras */
 const palm=add(new THREE.SphereGeometry(1,16,12),glove,.068,-.15,-.1);palm.scale.set(.032,.07,.045);
 for(let k=0;k<4;k++){const y=-.11-k*.04;add(new THREE.CapsuleGeometry(.014,.08,4,8),glove,.012,y,-(.281-k*.014),0,0,P)}
 add(new THREE.CapsuleGeometry(.014,.1,4,8),glove,.068,-.045,-.12,P,0,0);
 const a0=V3(.07,-.17,-.07),a1=V3(.2,-.5,.6);
 root.add(rod(a0,a1,.042,sleeve));root.add(rod(a0.clone().lerp(a1,.1),a0.clone().lerp(a1,.2),.048,paint));

 /* bouche de tir + éclair */
 const flash=new THREE.Group();flash.position.set(0,.03,-1.36);root.add(flash);flash.visible=false;
 add(new THREE.SphereGeometry(.07,12,10),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.85}),0,0,-.03,0,0,0,flash);
 add(new THREE.ConeGeometry(.06,.3,14,1,true),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}),0,0,-.2,P,0,0,flash);

 root.position.set(.24,-.2,-.62);root.rotation.set(.03,.04,0);
 const mzO=new THREE.Object3D();mzO.position.set(0,.03,-1.36);root.add(mzO);g.updateMatrixWorld(true);const muzzle=g.worldToLocal(mzO.getWorldPosition(V3(0,0,0)));
 g.traverse(o=>{o.castShadow=false});

 /* animation : recul + remontée, pompe, détente, clapotis du réservoir, balancement de marche */
 const anim=(r,fl,t,fps,held)=>{
  const mv=Math.min(1,Math.hypot(fps.v.x,fps.v.y)/fps.spd),ph=fps.bob*.5,pull=Math.min(1,Math.max(r*2.4,held?.85:0));
  root.position.set(.24+Math.sin(ph)*.009*mv,-.2-Math.abs(Math.sin(ph))*.01*mv+Math.sin(t*1.7)*.0025,-.62+r*.13);
  root.rotation.set(.03+r*.13,.04+Math.sin(ph)*.01*mv,r*.015);
  slide.position.z=Math.min(1,r*1.6)*.1;bar.position.z=r*.025;trig.rotation.x=-pull*.45;
  lq.scale.set(1+r*.1,1-r*.06,1+r*.1);lq.rotation.z=Math.sin(t*10)*r*.15;
  ledM.emissiveIntensity=.5+fl*2.2;flash.visible=fl>0;flash.scale.setScalar(.7+fl*.9)};
 return{g,muzzle,anim}}

/* ===== FIN PARTIE 2/5 — la partie 3 (jeu 1 : billes) continue juste après ===== */

/* ================= JEU 1 : la fosse aux billes ================= */
const H=(x,z)=>{const d=Math.hypot(x,z),t=clamp((d-14)/28,0,1)*4,f=Math.floor(t),s=(f+ease((t-f-.35)/.65))/4;
 return -20+20*s+(1-s)*.5*Math.sin(x*.5+z*.3)*Math.cos(z*.45)+clamp((d-42)/10,0,1)*(2.5*Math.sin(x*.05)*Math.cos(z*.04)+1.2*Math.sin(x*.13+z*.11))};

class Marbles{
 constructor(scene,cap){this.cap=cap;this.n=0;this.P=new Float32Array(cap*3);this.V=new Float32Array(cap*3);this.r=.08;
  const mat=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:.15,roughness:.05,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.8});
  this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),mat,cap);this.mesh.frustumCulled=false;
  const a=this.mesh.instanceMatrix.array,pal=[0xff4d6d,0x4dc9ff,0xffd93d,0x6bff8a,0xb36bff,0xff944d,0xffffff,0x2f5bff].map(c=>new THREE.Color(c)),ca=new Float32Array(cap*3);
  for(let i=0;i<cap;i++){a[i*16]=a[i*16+5]=a[i*16+10]=this.r;a[i*16+15]=1;const c=pal[i%8];ca.set([c.r,c.g,c.b],i*3)}
  this.mesh.instanceColor=new THREE.InstancedBufferAttribute(ca,3);scene.add(this.mesh);
  this.G=500;this.head=new Int32Array(this.G*this.G);this.next=new Int32Array(cap)}
 add(x,y,z){if(this.n>=this.cap)return false;const j=this.n*3;this.P[j]=x;this.P[j+1]=y;this.P[j+2]=z;this.V[j]=rnd(-.5,.5);this.V[j+1]=-2;this.V[j+2]=rnd(-.5,.5);this.n++;return true}
 remove(i){const n=--this.n,j=i*3,k=n*3,{P,V}=this;P[j]=P[k];P[j+1]=P[k+1];P[j+2]=P[k+2];V[j]=V[k];V[j+1]=V[k+1];V[j+2]=V[k+2]}
 suck(c,R,dt){const{P,V}=this;let out=0;for(let i=this.n-1;i>=0;i--){const j=i*3,dx=c.x-P[j],dy=c.y-P[j+1],dz=c.z-P[j+2],d2=dx*dx+dy*dy+dz*dz;
  if(d2<R*R){const d=Math.sqrt(d2)+1e-4,f=90*(1.2-d/R);V[j]=V[j]*.88+dx/d*f*dt;V[j+1]=V[j+1]*.88+dy/d*f*dt+9.8*dt;V[j+2]=V[j+2]*.88+dz/d*f*dt;if(d<.45){this.remove(i);out++}}}return out}
 step(dt){const{P,V,r,G,head,next}=this,n=this.n,cs=.2,off=50;head.fill(-1);
  for(let i=0;i<n;i++){const j=i*3;V[j+1]-=9.8*dt;P[j]+=V[j]*dt;P[j+1]+=V[j+1]*dt;P[j+2]+=V[j+2]*dt;
   const x=P[j],z=P[j+2],g=H(x,z)+r;if(P[j+1]<g){P[j+1]=g;const gx=(H(x+.1,z)-H(x-.1,z))*5,gz=(H(x,z+.1)-H(x,z-.1))*5,l=Math.hypot(gx,1,gz),nx=-gx/l,ny=1/l,nz=-gz/l,vn=V[j]*nx+V[j+1]*ny+V[j+2]*nz;
    if(vn<0){V[j]-=nx*vn*1.25;V[j+1]-=ny*vn*1.25;V[j+2]-=nz*vn*1.25}const fr=1-1.2*dt;V[j]*=fr;V[j+2]*=fr}
   const cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx>=0&&cz>=0&&cx<G&&cz<G){const c=cz*G+cx;next[i]=head[c];head[c]=i}else next[i]=-1}
  const D=2*r;for(let i=0;i<n;i++){const j=i*3,cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx<1||cz<1||cx>=G-1||cz>=G-1)continue;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){for(let o=head[(cz+b)*G+cx+a];o>=0;o=next[o]){if(o<=i)continue;const k=o*3,dx=P[k]-P[j],dy=P[k+1]-P[j+1],dz=P[k+2]-P[j+2],d2=dx*dx+dy*dy+dz*dz;
    if(d2<D*D&&d2>1e-8){const d=Math.sqrt(d2),ov=(D-d)*.5,nx=dx/d,ny=dy/d,nz=dz/d;P[j]-=nx*ov;P[j+1]-=ny*ov;P[j+2]-=nz*ov;P[k]+=nx*ov;P[k+1]+=ny*ov;P[k+2]+=nz*ov;
     const vr=(V[j]-V[k])*nx+(V[j+1]-V[k+1])*ny+(V[j+2]-V[k+2])*nz;if(vr>0){const h=vr*.55;V[j]-=nx*h;V[j+1]-=ny*h;V[j+2]-=nz*h;V[k]+=nx*h;V[k+1]+=ny*h;V[k+2]+=nz*h}}}}}
  const a=this.mesh.instanceMatrix.array;for(let i=0;i<n;i++){a[i*16+12]=P[i*3];a[i*16+13]=P[i*3+1];a[i*16+14]=P[i*3+2]}
  this.mesh.count=n;this.mesh.visible=n>0;this.mesh.instanceMatrix.needsUpdate=true}}

function nameTex(name){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#f3e2c0';x.fillRect(0,0,512,256);x.strokeStyle='#b0793c';x.lineWidth=14;x.strokeRect(7,7,498,242);
 x.fillStyle='#6b4423';x.font='bold 34px Sora,Arial';x.textAlign='center';x.fillText('LIVRAISON POUR',256,62);let s=110;x.fillStyle='#1b1208';do{x.font=`bold ${s}px Sora,Arial`;s-=4}while(x.measureText(name).width>470&&s>20);x.fillText(name,256,175);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

class Quarry{
 constructor(){const q=this.q=QUAL[S.q];this.scene=baseScene(q,0xa9c7d8,110);this.cam=new THREE.PerspectiveCamera(75,1,.05,600);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt);this.drones=[];this.peak=0;this.tip=new THREE.Vector3();
  const g=new THREE.PlaneGeometry(260,260,260,260);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,H(x,z));const d=Math.hypot(x,z);
   if(d>43)c.setRGB(.28+rnd(0,.06),.4+rnd(0,.08),.2);else if(d<15)c.setRGB(.76+rnd(0,.04),.68,.5);else{const b=Math.floor((d-14)/7)%2;c.setRGB(b?.82:.66,b?.8:.64,b?.74:.58)}col.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const t=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));t.receiveShadow=true;this.scene.add(t);
  for(let i=0;i<14;i++){const a=i/14*6.283+.3,r=55+rnd(0,25),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z);
   if(i%3==0)this.scene.add(mk(new THREE.CylinderGeometry(3,3,14,18),0xd8d8d0,x,y+7,z),mk(new THREE.ConeGeometry(3.2,3,18),0x8a8f94,x,y+15.5,z));
   else this.scene.add(box(10,5,7,x,y+2.5,z,0xb9b2a0,-a),box(10.6,.5,7.6,x,y+5.2,z,0x4a4f55,-a),box(2.5,3,.2,x+Math.cos(a)*0,y+1.5,z,0x7a6a55,-a))}
  const cx=-46,cz=-30,cy=H(cx,cz);this.scene.add(box(2,28,2,cx,cy+14,cz,0xe0a526),box(22,1.8,1.8,cx+8,cy+27,cz,0xe0a526),box(3,3,3,cx,cy+1.5,cz,0x333a40));
  for(let i=0;i<3;i++){const x=40+i*7,z=-48,y=H(x,z);this.scene.add(box(8,2.4,3.4,x,y+1.3,z,0xe0a526),box(3,3,3.4,x+4.6,y+1.8,z,0x2c3a4a),box(6,.2,3.5,x,y+2.6,z,0x5a5a55))}
  for(let i=0;i<90;i++){const a=rnd(0,6.283),r=rnd(48,110),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z),s=rnd(.9,1.8);this.scene.add(mk(new THREE.CylinderGeometry(.25*s,.3*s,2*s,6),0x5a3d22,x,y+s,z),mk(new THREE.ConeGeometry(1.8*s,5.5*s,7),0x2f5f2c,x,y+4*s,z))}
  this.m=new Marbles(this.scene,q.cap);this.vm=vacModel();this.vm.g.position.copy(this.vm.base);this.cam.add(this.vm.g);
  this.fps=new FPS(this.cam,0,H(0,10),10,0,{block:(nx,nz,y,ox,oz)=>Math.hypot(nx,nz)>115||(y<=H(ox,oz)+.1&&H(nx,nz)-y>Math.hypot(nx-ox,nz-oz)*1.9+.03),ground:(x,z)=>H(x,z)});this.reset()}
 total(){return this.m.n+this.lq+this.drones.reduce((a,d)=>a+d.rem,0)}
 reset(){this.lq=0;this.m.n=0;this.drones.forEach(d=>this.scene.remove(d.g));this.drones=[];for(let i=0;i<1500;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*12,x=Math.cos(a)*r,z=Math.sin(a)*r;this.m.add(x,H(x,z)+rnd(.3,2.5),z)}this.peak=this.total()}
 complete(){return this.total()===0}
 progress(){return this.peak?1-this.total()/this.peak:0}
 label(){return `${this.total().toLocaleString('fr-FR')} billes restantes`}
 gift(g,qty,name){const d=(g.m||0)*qty;if(!d)return;
  if(d>0){this.makeDrone(name,d);this.peak=Math.max(this.peak,this.total())}
  else{let k=-d;const a=Math.min(k,this.m.n);this.m.n-=a;k-=a;for(const x of this.drones){const b=Math.min(k,x.rem);x.rem-=b;k-=b}}}
 like(n){this.lq+=n;this.peak=Math.max(this.peak,this.total())}
 target(){const p=this.fps.p,y=this.fps.yaw;return V3(p.x-Math.sin(y)*5,p.y+13,p.z-Math.cos(y)*5)}
 makeDrone(name,n){const g=new THREE.Group(),dk=new THREE.MeshStandardMaterial({color:0x222831,metalness:.6,roughness:.4}),rot=[];
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4,.6,1.5),dk));
  for(const[x,z]of[[1.5,1],[-1.5,1],[1.5,-1],[-1.5,-1]]){const a=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x,z)*2,.12,.12),dk);a.position.set(x/2,0,z/2);a.rotation.y=-Math.atan2(z,x);g.add(a);
   const r=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.05,20),new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.45}));r.position.set(x,.25,z);g.add(r);rot.push(r)}
  const c=new THREE.Group();c.position.y=-1.4;g.add(c);c.add(box(3.2,2,2.2,0,0,0,0xc99a5b));c.add(box(.5,2.02,2.22,0,0,0,0xe7d3a8));
  const lm=new THREE.MeshBasicMaterial({map:nameTex(name)}),f=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),lm),b=f.clone();f.position.set(0,0,1.12);b.position.set(0,0,-1.12);b.rotation.y=Math.PI;c.add(f,b);
  const fl=[1,-1].map(s=>{const p=new THREE.Group();p.position.set(0,1,s*1.1);p.add(box(3.2,.08,1.1,0,0,-s*.55,0xb98a4c));c.add(p);return p});
  const T=this.target();g.scale.setScalar(1.8);g.position.set(T.x-70,T.y+14,T.z-50);this.scene.add(g);this.drones.push({g,c,rot,fl,s:0,t:0,rem:n,n,s0:g.position.clone()})}
 updDrone(d,dt){d.t+=dt;d.rot.forEach(r=>r.rotation.y+=dt*45);const g=d.g,T=this.target(),cp=this.cam.position;
  if(d.s===0){const u=ease(d.t/3);g.position.lerpVectors(d.s0,T,u);if(d.t>3){d.s=1;d.t=0}}else if(d.s<5)g.position.lerp(T,Math.min(1,dt*3));
  if(d.s<5)g.rotation.y=Math.atan2(cp.x-g.position.x,cp.z-g.position.z);
  if(d.s===1){d.c.position.y=-1.4-3*ease(d.t/1.1);if(d.t>1.1){d.s=2;d.t=0}}
  else if(d.s===2){const a=ease(d.t/.8)*2.1;d.fl[0].rotation.x=-a;d.fl[1].rotation.x=a;if(d.t>.8){d.s=3;d.t=0}}
  else if(d.s===3){const k=Math.min(d.rem,Math.ceil(dt*Math.max(120,d.n/3.5))),w=V3(0,0,0);d.c.getWorldPosition(w);
   for(let i=0;i<k;i++)if(this.m.add(w.x+rnd(-1.4,1.4),w.y+.8,w.z+rnd(-1,1)))d.rem--;else break;if(d.rem<=0){d.s=4;d.t=0}}
  else if(d.s===4){const u=ease(d.t/.7);d.c.scale.setScalar(Math.max(.001,1-u));d.fl.forEach((f,i)=>f.rotation.x=(i?1:-1)*2.1*(1-u));if(d.t>.7){d.s=5;d.t=0;d.c.visible=false}}
  else if(d.s===5){g.position.x+=dt*16*d.t;g.position.y+=dt*8*d.t;if(d.t>2.4){this.scene.remove(g);d.dead=true}}}
 update(dt){const cam=this.cam;this.fps.update(dt);cam.updateMatrixWorld(true);const on=M.down&&App.locked&&!App.paused;this.sucking=on;Snd.vac(on);
  this.tip.copy(this.vm.tip);cam.localToWorld(this.tip);const tp=this.tip;
  if(on){const k=this.m.suck(tp,3.4,dt);if(k)this.parts.emit(tp.x,tp.y,tp.z,0xdff6ff,Math.min(k,5),2);
   for(let i=0;i<5;i++)this.parts.flow(V3(tp.x+rnd(-2.6,2.6),tp.y+rnd(-1.6,1),tp.z+rnd(-2.6,2.6)),tp,0x9be7ff);
   this.vm.g.position.set(rnd(-.004,.004),rnd(-.004,.004),rnd(-.004,.004));this.vm.brush.rotation.y+=dt*40}else this.vm.g.position.set(0,0,0);
  if(this.lq>0){const k=Math.min(this.lq,Math.max(200,Math.ceil(this.lq*dt*2)));for(let i=0;i<k;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*12,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!this.m.add(x,H(x,z)+rnd(8,14),z))break;this.lq--}this.peak=Math.max(this.peak,this.total())}
 this.drones.forEach(x=>this.updDrone(x,dt));this.drones=this.drones.filter(x=>!x.dead);this.m.step(Math.min(dt,1/30));this.parts.update(dt)}
 dispose(){Snd.vac(false);disposeScene(this.scene)}}

/* ===== FIN PARTIE 3/5 — la partie 4 (jeu 2 : peinture) continue juste après ===== */

/* ================= JEU 2 : la bataille de peinture ================= */
const PX=8,AX=45,AZ=35;
/* Réglages du pistolet à peinture : pellets=billes de peinture par tir, spread=dispersion, rate=ms entre deux tirs,
   speed=vitesse des projectiles, grav=chute, R=rayon de la flaque principale (en mètres) */
const PAINT={pellets:8,spread:3,rate:110,speed:42,grav:3.5,R:4.4};
class Panel{
 constructor(w,h,pos,ry,rx,color,owner){this.owner=owner;this.color=color;this.nx=Math.max(2,Math.round(w/.6));this.ny=Math.max(2,Math.round(h/.6));this.cv=document.createElement('canvas');this.cv.width=this.nx*PX;this.cv.height=this.ny*PX;this.cx=this.cv.getContext('2d');
  this.tex=new THREE.CanvasTexture(this.cv);this.tex.colorSpace=THREE.SRGBColorSpace;this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:this.tex,roughness:.7,side:THREE.DoubleSide}));
  this.mesh.position.copy(pos);this.mesh.rotation.set(rx,ry,0);this.mesh.receiveShadow=this.mesh.castShadow=true;this.mesh.updateMatrixWorld(true);this.rad=Math.hypot(w,h)/2+.1;this.c=V3(0,0,0);this.mesh.getWorldPosition(this.c);
  this.n=V3(0,0,1).transformDirection(this.mesh.matrixWorld);this.ca=(w/this.nx)*(h/this.ny);
  const N=this.nx*this.ny;this.st=new Uint8Array(N);this.act=new Uint8Array(N).fill(1);this.ct=new Float32Array(N*3);const v=V3(0,0,0);
  for(let y=0;y<this.ny;y++)for(let x=0;x<this.nx;x++){v.set(((x+.5)/this.nx-.5)*w,((y+.5)/this.ny-.5)*h,0);this.mesh.localToWorld(v);this.ct.set([v.x,v.y,v.z],(y*this.nx+x)*3)}this.clear()}
 clear(){this.st.fill(0);this.cx.fillStyle=this.color;this.cx.fillRect(0,0,this.cv.width,this.cv.height);this.tex.needsUpdate=true}
 cell(i,col){this.st[i]=col;const x=i%this.nx,y=(i/this.nx)|0,c=this.cx,px=(x+.5)*PX,py=(this.ny-1-y+.5)*PX;c.fillStyle=COLH[col];
  c.beginPath();c.arc(px+rnd(-1.5,1.5),py+rnd(-1.5,1.5),PX*rnd(.85,1.2),0,6.3);c.fill();
  if(Math.random()<.3){c.beginPath();c.arc(px+rnd(-PX*1.4,PX*1.4),py+rnd(-PX*1.4,PX*1.4),PX*rnd(.2,.4),0,6.3);c.fill()}this.dirty=true}}

class Paint{
 constructor(col){const q=this.q=QUAL[S.q];this.col=col;this.scene=baseScene(q,0xb8d4e8,60);this.cam=new THREE.PerspectiveCamera(75,1,.05,500);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt*4);this.panels=[];this.blocks=[];this.bombs=[];this.shots=[];this.fx=[];this.qa=0;this.qr=0;this.acc=0;this.last=0;this.rec=0;this.sc=0;this.ls=0;
  const out=mk(new THREE.PlaneGeometry(500,500),0x6f8f5a,0,-.06,0);out.rotation.x=-Math.PI/2;this.scene.add(out);
  for(let x=-40;x<=40;x+=10)for(let z=-30;z<=30;z+=10)this.pan(10,10,[x,0,z],0,-Math.PI/2,'#d4dade');
  for(let z=-30;z<=30;z+=10){this.pan(10,4,[-AX,2,z],Math.PI/2,0,'#b7c0c7');this.pan(10,4,[AX,2,z],-Math.PI/2,0,'#b7c0c7')}
  for(let x=-40;x<=40;x+=10){this.pan(10,4,[x,2,-AZ],0,0,'#b7c0c7');this.pan(10,4,[x,2,AZ],Math.PI,0,'#b7c0c7')}
  const pal=['#e8e6df','#9fb1c1','#c9b79c','#8aa08f','#d8c3c3','#6f7c8a','#e3c88a'];let sd=11;const R=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const T=[[4,2.2,4],[3,1.6,5],[1.6,3.2,1.6],[.9,2.8,.9],[7,1.8,.8],[.8,1.8,7],[1.5,.8,1.5],[2,.7,2],[2.5,1.2,2.5],[3,.6,3],[5,1,2]];
  for(let i=0,k=0;i<1500&&k<62;i++){const t=T[k%T.length],w=t[0]*(.8+R()*.5),h=t[1]*(.8+R()*.4),d=t[2]*(.8+R()*.5),x=(R()-.5)*82,z=(R()-.5)*62;
   if(x<-30&&Math.abs(z)<8)continue;if(this.blocks.some(b=>x+w/2+2.5>b.x0&&x-w/2-2.5<b.x1&&z+d/2+2.5>b.z0&&z-d/2-2.5<b.z1))continue;
   this.addBlock(w,h,d,x,z,0,pal[k%pal.length]);k++;if(k%9==0){const b=this.blocks[this.blocks.length-1];this.addBlock(w*.55,h*.8,d*.55,x,z,b.y1,pal[(k+3)%pal.length])}}
  for(const p of this.panels)for(let i=0;i<p.st.length;i++){const x=p.ct[i*3],y=p.ct[i*3+1],z=p.ct[i*3+2];
   if(this.blocks.some(b=>b!==p.owner&&x>b.x0-.05&&x<b.x1+.05&&y>b.y0-.05&&y<b.y1+.05&&z>b.z0-.05&&z<b.z1+.05))p.act[i]=0}
  this.meshes=this.panels.map(p=>p.mesh);
  this.vm=paintGun(col);this.cam.add(this.vm.g);this.parts.o.material.size=.5;this.fl=0;
  this.bg=new THREE.SphereGeometry(.38,14,10);this.shotG=new THREE.SphereGeometry(.2,10,8);this.shotM=new THREE.MeshStandardMaterial({color:COLN[col],emissive:COLN[col],emissiveIntensity:.8,roughness:.3});this.sg=new THREE.SphereGeometry(1,16,12);
  this.fps=new FPS(this.cam,-40,0,0,-Math.PI/2,{
   block:(nx,nz,y)=>Math.abs(nx)>AX-.4||Math.abs(nz)>AZ-.4||this.blocks.some(b=>nx>b.x0-.35&&nx<b.x1+.35&&nz>b.z0-.35&&nz<b.z1+.35&&y<b.y1-.25&&y+1.8>b.y0),
   ground:(x,z,y)=>{let g=0;for(const b of this.blocks)if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2&&b.y1<=y+.4&&b.y1>g)g=b.y1;return g},
   clamp:f=>{const p=f.p;p.x=clamp(p.x,-AX+.5,AX-.5);p.z=clamp(p.z,-AZ+.5,AZ-.5);if(p.y<0){p.y=0;f.vy=0}if(p.y>40){p.y=40;f.vy=Math.min(0,f.vy)}
    for(const b of this.blocks)if(p.x>b.x0-.3&&p.x<b.x1+.3&&p.z>b.z0-.3&&p.z<b.z1+.3&&p.y<b.y1-.3&&p.y+1.8>b.y0){p.y=b.y1;f.vy=0}}});Object.assign(this.fps,{spd:15,ac:30,gv:30,jp:11});this.reset()}
 pan(w,h,p,ry,rx,color,o=null){const a=new Panel(w,h,V3(...p),ry,rx,color,o);this.panels.push(a);this.scene.add(a.mesh)}
 addBlock(w,h,d,x,z,y0,c){const b={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0,y1:y0+h},yc=y0+h/2,P=Math.PI;this.blocks.push(b);
  this.pan(w,h,[x,yc,z+d/2],0,0,c,b);this.pan(w,h,[x,yc,z-d/2],P,0,c,b);this.pan(d,h,[x+w/2,yc,z],P/2,0,c,b);this.pan(d,h,[x-w/2,yc,z],-P/2,0,c,b);this.pan(w,d,[x,y0+h+.005,z],0,-P/2,c,b)}
 reset(){this.panels.forEach(p=>p.clear());[...this.bombs,...this.shots,...this.fx].forEach(o=>this.scene.remove(o.m));this.bombs=[];this.shots=[];this.fx=[];this.qa=this.qr=0;this.st0=this.stats()}
 /* surfaces pondérées par l'aire réelle de chaque case (t/p = aire totale/peinte, tc/pc = nombre de cases) */
 stats(){let t=0,p=0,tc=0,pc=0;for(const a of this.panels){let n=0,m=0;for(let i=0;i<a.st.length;i++)if(a.act[i]){n++;if(a.st[i]===this.col)m++}t+=n*a.ca;p+=m*a.ca;tc+=n;pc+=m}return{t,p,tc,pc}}
 progress(){return this.st0.t?this.st0.p/this.st0.t:0}
 /* victoire atteignable : à 99,6 % des cases, les dernières cases oubliées sont complétées (progression = 100 %) */
 complete(){const s=this.st0;if(s.tc>0&&s.pc>=s.tc*.996){if(s.pc<s.tc){this.fillAll();this.st0=this.stats()}return true}return false}
 fillAll(){for(const a of this.panels)for(let i=0;i<a.st.length;i++)if(a.act[i]&&a.st[i]!==this.col)a.cell(i,this.col)}
 label(){return `${(this.progress()*100).toFixed(1)} % peint`}
 gift(g,qty){const n=(g.k||0)*qty;if(g.red)this.qr+=n;else this.qa+=n}
 like(n){this.qr+=n}
 splat(pt,R,col,jit){for(const a of this.panels){if(a.c.distanceTo(pt)>R+a.rad)continue;for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const dx=a.ct[i*3]-pt.x,dy=a.ct[i*3+1]-pt.y,dz=a.ct[i*3+2]-pt.z,r=R*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r)a.cell(i,col)}}}
 /* peint une liste de flaques {p:centre,r:rayon} ; une flaque ne couvre que les faces tournées vers elle (pas de peinture derrière un mur fin) */
 paintBlobs(bl,col,jit){for(const a of this.panels){const ok=[];for(const b of bl){const R=b.r+a.rad;if(a.c.distanceToSquared(b.p)>R*R)continue;
   if(a.n.x*(b.p.x-a.c.x)+a.n.y*(b.p.y-a.c.y)+a.n.z*(b.p.z-a.c.z)>-.25)ok.push(b)}
  if(!ok.length)continue;
  for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const x=a.ct[i*3],y=a.ct[i*3+1],z=a.ct[i*3+2];
   for(const b of ok){const dx=x-b.p.x,dy=y-b.p.y,dz=z-b.p.z,r=b.r*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r){a.cell(i,col);break}}}}}
 /* impact d'un tir : grosse flaque + éclaboussures satellites + gouttelettes + traînée dans le sens du tir + coulures sur les murs */
 impact(h,dir){const q=h.point,n=h.face.normal.clone().transformDirection(h.object.matrixWorld);if(n.dot(dir)>0)n.negate();
  const ref=Math.abs(n.y)>.95?V3(1,0,0):V3(0,1,0),t1=ref.cross(n).normalize(),t2=n.clone().cross(t1).normalize(),bl=[{p:q.clone(),r:PAINT.R}];
  const on=(a,d,r)=>bl.push({p:q.clone().addScaledVector(t1,Math.cos(a)*d).addScaledVector(t2,Math.sin(a)*d),r});
  for(let k=0;k<12;k++)on(rnd(0,6.283),rnd(2,6.5),rnd(1,2.3));
  for(let k=0;k<12;k++)on(rnd(0,6.283),rnd(3,8),rnd(.35,.8));
  const sl=dir.clone().addScaledVector(n,-dir.dot(n));if(sl.lengthSq()>1e-4){sl.normalize();for(const[d,r]of[[1.6,1.8],[3.2,1.2],[4.6,.7]])bl.push({p:q.clone().addScaledVector(sl,d),r})}
  if(Math.abs(n.y)<.5)for(let k=0;k<4;k++)bl.push({p:q.clone().addScaledVector(t1,rnd(-.4,.4)).add(V3(0,-(2.6+k*1.3),0)),r:rnd(.4,.6)});
  this.paintBlobs(bl,this.col,.4);
  this.parts.emit(q.x+n.x*.2,q.y+n.y*.2,q.z+n.z*.2,COLN[this.col],50,6.5,2.2);
  const now=performance.now();if(now-this.ls>80){this.ls=now;Snd.noise(.14,.25,1400)}}
 spawnBomb(col){let x,z,y=0,t=0;if(Math.random()<.4){const b=this.blocks[(Math.random()*this.blocks.length)|0];x=rnd(b.x0,b.x1);z=rnd(b.z0,b.z1);y=b.y1;for(const o of this.blocks)if(x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&o.y1>y)y=o.y1}
  else do{x=rnd(-AX+2,AX-2);z=rnd(-AZ+2,AZ-2)}while(this.blocks.some(b=>x>b.x0-1&&x<b.x1+1&&z>b.z0-1&&z<b.z1+1)&&++t<20);
  const m=mk(this.bg,COLN[col],x,y+25,z,{e:COLN[col],r:.3});m.add(mk(new THREE.CylinderGeometry(.06,.06,.4,6),0xffffff,0,.5,0));this.scene.add(m);this.bombs.push({m,col,y:y+25,gy:y+.4,vy:0,s:0,t:0,f:rnd(.7,1.5)})}
 explode(b){const p=b.m.position;this.splat(p,4.5,b.col,.35);this.parts.emit(p.x,p.y+.5,p.z,COLN[b.col],70,8,3);Snd.boom();
  const m=new THREE.Mesh(this.sg,new THREE.MeshBasicMaterial({color:COLN[b.col],transparent:true,opacity:.5}));m.position.copy(p);this.scene.add(m);this.fx.push({m,t:0});this.scene.remove(b.m);b.dead=true}
 fire(){const mz=this.vm.muzzle.clone();this.cam.localToWorld(mz);const fw=this.cam.getWorldDirection(V3(0,0,0)),rt=V3(0,0,0).setFromMatrixColumn(this.cam.matrixWorld,0),up=V3(0,0,0).setFromMatrixColumn(this.cam.matrixWorld,1);
  for(let i=0;i<PAINT.pellets;i++){const sp=i?PAINT.spread:0,tg=this.cam.position.clone().addScaledVector(fw,40).addScaledVector(rt,rnd(-sp,sp)).addScaledVector(up,rnd(-sp,sp)),v=tg.sub(mz).normalize().multiplyScalar(PAINT.speed*rnd(.92,1.05));
   const m=new THREE.Mesh(this.shotG,this.shotM);m.position.copy(mz);m.scale.setScalar(rnd(.8,1.5));this.scene.add(m);this.shots.push({m,v,t:0})}
  Snd.pop();Snd.noise(.09,.35,2600);this.parts.emit(mz.x,mz.y,mz.z,COLN[this.col],40,5,1);this.rec=1;this.fl=1}
 update(dt){this.fps.update(dt);this.cam.updateMatrixWorld(true);const now=performance.now(),held=M.down&&App.locked&&!App.paused;
  this.vm.anim(this.rec,this.fl,now/1e3,this.fps,held);this.rec=Math.max(0,this.rec-dt*8);this.fl=Math.max(0,this.fl-dt*14);
  if(held&&now-this.last>PAINT.rate){this.last=now;this.fire()}
  const pend=this.qa+this.qr;if(pend>0&&this.bombs.length<90){this.acc+=dt*Math.max(5,pend/6);while(this.acc>=1&&this.qa+this.qr>0&&this.bombs.length<90){this.acc--;const red=Math.random()*(this.qa+this.qr)<this.qr;if(red)this.qr--;else this.qa--;this.spawnBomb(red?3:this.col)}}
  for(const b of this.bombs){if(b.s===0){b.vy-=16*dt;b.y+=b.vy*dt;if(b.y<=b.gy){b.y=b.gy;b.s=1}b.m.position.y=b.y}else{b.t+=dt;b.m.scale.setScalar(1+.15*Math.sin(b.t*28));if(b.t>b.f)this.explode(b)}}this.bombs=this.bombs.filter(b=>!b.dead);
  for(const s of this.shots){const pv=s.m.position.clone();s.v.y-=PAINT.grav*dt;s.m.position.addScaledVector(s.v,dt);s.t+=dt;
   const d=s.m.position.clone().sub(pv),L=d.length();if(L>0)d.divideScalar(L);
   /* on ne teste que les panneaux proches du segment parcouru (beaucoup plus léger avec de nombreux projectiles) */
   const mid=pv.clone().addScaledVector(d,L/2),cand=[];for(const p of this.panels){const R=L/2+p.rad;if(p.c.distanceToSquared(mid)<R*R)cand.push(p.mesh)}
   rc.set(pv,d);rc.far=L;const r=cand.length?rc.intersectObjects(cand,false):[];rc.far=Infinity;
   this.parts.emit(pv.x,pv.y,pv.z,COLN[this.col],3,.6);
   if(r.length){this.impact(r[0],d);s.dead=true}else if(s.t>5)s.dead=true;if(s.dead)this.scene.remove(s.m)}this.shots=this.shots.filter(s=>!s.dead);
  for(const f of this.fx){f.t+=dt;f.m.scale.setScalar(.3+f.t*13);f.m.material.opacity=Math.max(0,.5-f.t*1.6);if(f.t>.35){f.dead=true;this.scene.remove(f.m)}}this.fx=this.fx.filter(f=>!f.dead);
  this.panels.forEach(p=>{if(p.dirty){p.tex.needsUpdate=true;p.dirty=false}});if(++this.sc%6===0)this.st0=this.stats();this.parts.update(dt)}
 dispose(){this.panels.forEach(p=>p.tex.dispose());disposeScene(this.scene)}}

/* ===== FIN PARTIE 4/5 — la partie 5 (jeu 3 rampe, application, TikFinity, interface) continue juste après ===== */

/* ================= JEU 3 : la rampe aux fruits ================= */
const RW=13.6,RL=330,RZ0=12,RFIN=300;
const RP=[[0,0],[30,0],[60,12],[85,12],[125,34],[150,34],[200,62],[225,62],[270,86],[RL,86]];
const rh=z=>{const s=clamp(RZ0-z,0,RL);for(let i=1;i<RP.length;i++)if(s<=RP[i][0]){const a=RP[i-1],b=RP[i];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0])}return 86};
const FRUITS=[
 {n:'Pomme',c:0xe02020,s:[.42,.4,.42],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Orange',c:0xff8a00,s:[.45,.45,.45],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Citron',c:0xffe135,s:[.5,.34,.34],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Pastèque',c:0x2e9e3a,s:[.8,.6,.6],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Banane',c:0xffd83a,s:[.45,.45,.45],g:()=>new THREE.TorusGeometry(1,.22,8,16,2.3)},
 {n:'Fraise',c:0xd8152f,s:[.28,.3,.28],g:()=>new THREE.ConeGeometry(1,2,12)}];
const finTex=()=>{const c=document.createElement('canvas');c.width=256;c.height=32;const x=c.getContext('2d');for(let i=0;i<32;i++)for(let j=0;j<4;j++){x.fillStyle=(i+j)%2?'#fff':'#111';x.fillRect(i*8,j*8,8,8)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};
const bannerTex=()=>{const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='#ffc83d';x.fillRect(0,0,512,96);x.fillStyle='#111';x.font='bold 72px Sora,Arial';x.textAlign='center';x.fillText('ARRIVÉE',256,72);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};

/* Personnage 3e personne : 15 points (squelette), os = cylindres, contraintes de distance (ragdoll Verlet) */
const CB=[[0,1.68,0],[0,1.48,0],[0,.98,0],[-.27,1.42,0],[.27,1.42,0],[-.33,1.12,0],[.33,1.12,0],[-.35,.85,0],[.35,.85,0],[-.13,.92,0],[.13,.92,0],[-.13,.5,0],[.13,.5,0],[-.13,.05,0],[.13,.05,0]];
const CN=[[0,1,.09,0xe0a97c],[1,2,.14,0x2f7bff],[3,4,.06,0x2f7bff],[1,3,.07,0x2f7bff],[1,4,.07,0x2f7bff],[3,5,.06,0x2f7bff],[5,7,.055,0xe0a97c],[4,6,.06,0x2f7bff],[6,8,.055,0xe0a97c],[2,9,.08,0x23304a],[2,10,.08,0x23304a],[9,10,.07,0x23304a],[9,11,.08,0x23304a],[11,13,.07,0x23304a],[10,12,.08,0x23304a],[12,14,.07,0x23304a]];
const CX=[[3,10],[4,9],[1,9],[1,10],[0,2],[3,2],[4,2]];
class Ramp{
 constructor(){const q=this.q=QUAL[S.q];this.scene=baseScene(q,0x9fd4f0,170);this.cam=new THREE.PerspectiveCamera(75,1,.05,700);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt*2);this.parts.o.material.size=.45;this.f=[];this.qn=0;this.acc=0;this.pq=0;this.pu=null;this.boxes=[];
  const gp=new THREE.PlaneGeometry(2*RW+2,RL+20,14,(RL+20)/2);gp.rotateX(-Math.PI/2);const p=gp.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const z=p.getZ(i)-153;p.setZ(i,z);p.setY(i,rh(z));const b=Math.floor((RZ0-z)/10)%2;c.setRGB(b?.78:.68,b?.74:.64,b?.62:.55);col.set([c.r,c.g,c.b],i*3)}
  gp.setAttribute('color',new THREE.BufferAttribute(col,3));gp.computeVertexNormals();const t=new THREE.Mesh(gp,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));t.receiveShadow=true;this.scene.add(t);
  const far=mk(new THREE.PlaneGeometry(1200,1200),0x6f9a58,0,-3,-150);far.rotation.x=-Math.PI/2;this.scene.add(far);
  for(let s=20;s<=RL;s+=45){const h=rh(RZ0-s);for(const sx of[-1,1])this.scene.add(box(3,h+3,3,sx*(RW+.5),(h-3)/2,RZ0-s,0x8a8f94))}
  for(let s=0;s<RL;s+=10){const h0=rh(RZ0-s),h1=rh(RZ0-s-10);for(const sx of[-1,1]){const m=box(.6,1.6,10.2,sx*(RW+.3),(h0+h1)/2+.8,RZ0-s-5,0xd04a3a);m.rotation.x=Math.atan2(h1-h0,10);this.scene.add(m)}}
  let sd=7;const R=()=>(sd=(sd*16807)%2147483647)/2147483647,pal=[0x8aa08f,0xc9b79c,0x9fb1c1,0xd8c3c3,0xe3c88a];
  const addB=(x,s,w,d,hg,cl)=>{const zc=RZ0-s,z0=zc-d/2,z1=zc+d/2,yt=rh(z0)+hg,yb=rh(z1)-.3;this.scene.add(box(w,yt-yb,d,x,(yt+yb)/2,zc,cl));this.boxes.push({x0:x-w/2,x1:x+w/2,z0,z1,y1:yt})};
  for(let s=24;s<RFIN-10;s+=9){const wx=(R()-.5)*2*(RW-6);if(R()<.6)addB(wx,s,6+R()*4,.8,1.8,pal[(s/9|0)%5]);if(R()<.45){let x=(R()-.5)*2*(RW-3);if(Math.abs(x-wx)<6)x=-Math.sign(wx||1)*(RW-3);addB(x,s+3,3,3,2.2,0x6f7c8a)}}
  const fz=RZ0-RFIN;for(const sx of[-1,1])this.scene.add(box(1,9,1,sx*(RW-.5),90.5,fz,0xffffff));
  const bn=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,2.6),new THREE.MeshBasicMaterial({map:bannerTex(),side:THREE.DoubleSide}));bn.position.set(0,95.2,fz);this.scene.add(bn);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,2),new THREE.MeshBasicMaterial({map:finTex()}));fl.rotation.x=-Math.PI/2;fl.position.set(0,86.05,fz);this.scene.add(fl);
  const zn=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,RL-RFIN),new THREE.MeshBasicMaterial({color:0x2ed36a,transparent:true,opacity:.35}));zn.rotation.x=-Math.PI/2;zn.position.set(0,86.04,fz-(RL-RFIN)/2);this.scene.add(zn);
  this.im=FRUITS.map(d=>{const m=new THREE.InstancedMesh(d.g(),new THREE.MeshStandardMaterial({color:d.c,roughness:.45}),600);m.frustumCulled=false;m.count=0;this.scene.add(m);return m});this.dm=new THREE.Object3D();
  const gl=this.gl=new THREE.Group(),rm=new THREE.MeshStandardMaterial({color:0xd01f2b,roughness:.4}),wm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6}),sk=new THREE.MeshStandardMaterial({color:0xe0a97c,roughness:.7}),P2=Math.PI/2;
  const fist=new THREE.Mesh(new THREE.SphereGeometry(.6,18,14),rm);fist.scale.set(1,.9,1.1);gl.add(fist);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.6,16),wm);cuff.rotation.x=P2;cuff.position.z=-.8;gl.add(cuff);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,4,12),sk);arm.rotation.x=P2;arm.position.z=-3.1;gl.add(arm);gl.visible=false;this.scene.add(gl);
  const bx=this.boxes;
  this.fps=new FPS(this.cam,0,0,RZ0-3,0,{bx,
   block:(nx,nz,y)=>Math.abs(nx)>RW-.2||nz>RZ0-.5||nz<RZ0-RL+1||bx.some(b=>nx>b.x0-.35&&nx<b.x1+.35&&nz>b.z0-.35&&nz<b.z1+.35&&y<b.y1-.3),
   ground:(x,z,y)=>{let g=rh(z);for(const b of bx)if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2&&b.y1<=y+.45&&b.y1>g)g=b.y1;return g}});
  this.buildChar();this.reset()}
 reset(){const f=this.fps;this.rag=this.inv=0;this.face=0;this.ph=0;f.p.set(0,0,RZ0-3);f.yaw=0;f.pitch=.3;f.rag=f.inv=f.kx=f.kz=0;f.v.set(0,0);f.vy=0;this.f.length=0;this.qn=0;this.pq=0;this.pu=null;this.gl.visible=false}
 complete(){const z=this.rag>0?this.P[2].z:this.fps.p.z;return z<RZ0-RFIN&&z>RZ0-RL}
 progress(){return clamp((RZ0-this.fps.p.z)/RFIN,0,1)}
 label(){return `Rampe : ${Math.round(this.progress()*100)} % · ${this.f.length+this.qn} fruits`}
 gift(g,qty){this.qn+=(g.k||0)*qty*5}
 like(n){this.qn+=n}
 follow(){this.pq++}
 spawn(){const p=this.fps.p,t=(Math.random()*FRUITS.length)|0,d=FRUITS[t],near=Math.random()<.5,
  x=clamp(near?p.x+rnd(-3,3):p.x+rnd(-12,12),-RW+1,RW-1),z=clamp(p.z+(near?rnd(-14,-2):rnd(-24,3)),RZ0-RL+3,RZ0-3);
  if(this.f.length>=1800)this.f.shift();this.f.push({age:0,t,x,y:rh(z)+rnd(14,30),z,vx:rnd(-1,1),vy:0,vz:rnd(0,3),r:Math.max(...d.s),a:rnd(0,6),b:rnd(0,6)})}
 hit(o){const f=this.fps;this.startRag(5,o.vx*.6,4,o.vz*.6)
  this.parts.emit(o.x,o.y,o.z,FRUITS[o.t].c,30,5,2);Snd.pop();ev('🍎 Touché ! ragdoll 5 s')}
 fruit(dt){const p=this.fps.p,w=this.fps.w,L=this.f;
  for(let i=L.length-1;i>=0;i--){const o=L[i];if((o.age+=dt)>=10){L.splice(i,1);continue}o.vy-=22*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.z+=o.vz*dt;
   if(Math.abs(o.x)>RW-.3){o.x=clamp(o.x,-RW+.3,RW-.3);o.vx*=-.5}
   for(const b of this.boxes)if(o.x>b.x0&&o.x<b.x1&&o.z>b.z0&&o.z<b.z1&&o.y<b.y1-.3){const a=o.x-b.x0,c=b.x1-o.x,d=o.z-b.z0,e=b.z1-o.z,m=Math.min(a,c,d,e);
    if(m===a){o.x=b.x0;o.vx=-Math.abs(o.vx)*.4}else if(m===c){o.x=b.x1;o.vx=Math.abs(o.vx)*.4}else if(m===d){o.z=b.z0;o.vz=-Math.abs(o.vz)*.4}else{o.z=b.z1;o.vz=Math.abs(o.vz)*.4}}
   const g=w.ground(o.x,o.z,o.y)+o.r*.8;
   if(o.y<g){o.y=g;const sl=(rh(o.z+.1)-rh(o.z-.1))/.2,l=Math.hypot(1,sl),ny=1/l,nz=-sl/l,vn=o.vy*ny+o.vz*nz;if(vn<0){o.vy-=ny*vn*1.45;o.vz-=nz*vn*1.45}o.vx*=1-.6*dt;o.vz*=1-.15*dt}
   o.a+=o.vz*dt*2;o.b+=o.vx*dt*2;
   if(o.z>RZ0-1||o.y<-5){L.splice(i,1);continue}
   const dx=o.x-p.x,dz=o.z-p.z,dy=o.y-(p.y+.9);
   if(dx*dx+dz*dz<(.5+o.r)**2&&Math.abs(dy)<1+o.r&&this.inv<=0&&this.rag<=0){this.hit(o);L.splice(i,1)}}
  const cnt=FRUITS.map(()=>0),D=this.dm;
  for(const o of L){const k=cnt[o.t];if(k>=600)continue;cnt[o.t]++;D.position.set(o.x,o.y,o.z);D.rotation.set(o.a,o.b,0);D.scale.set(...FRUITS[o.t].s);D.updateMatrix();this.im[o.t].setMatrixAt(k,D.matrix)}
  this.im.forEach((m,i)=>{m.count=cnt[i];m.instanceMatrix.needsUpdate=true})}
 punchStep(dt){const f=this.fps,G=this.gl;
  if(!this.pu){if(this.pq>0){this.pq--;this.pu={t:0,hit:false};G.visible=true;Snd.tone(300,90,.25,'sawtooth',.4)}else return}
  const u=this.pu,p=f.p,y=f.yaw,fx=-Math.sin(y),fz=-Math.cos(y);u.t+=dt;
  const d=u.t<.3?5-3.9*ease(u.t/.3):1.1+3.9*ease((u.t-.3)/.3);
  G.position.set(p.x+fx*d,p.y+1.2,p.z+fz*d);G.rotation.set(0,y,0);
  if(!u.hit&&u.t>=.3){u.hit=true;this.startRag(2,-fx*17,4,-fz*17,true);Snd.boom();this.parts.emit(p.x+fx,p.y+1.2,p.z+fz,0xffffff,40,7,1);ev('👊 Coup de poing ! ragdoll 2 s')}
  if(u.t>.6){this.pu=null;G.visible=false}}
 update(dt){this.char(dt);this.cam.updateMatrixWorld(true);
  if(this.qn>0){this.acc+=dt*Math.max(60,this.qn/4);while(this.acc>=1&&this.qn>0){this.acc--;this.qn--;this.spawn()}}
  this.fruit(dt);this.punchStep(dt);this.parts.update(dt)}
 buildChar(){this.P=CB.map(b=>V3(...b));this.Q=this.P.map(p=>p.clone());this.cs=[...CN.map(b=>[b[0],b[1]]),...CX].map(([a,b])=>[a,b,V3(...CB[a]).distanceTo(V3(...CB[b]))]);
  const cy=new THREE.CylinderGeometry(1,1,1,10);this.bm=CN.map(b=>{const m=new THREE.Mesh(cy,new THREE.MeshStandardMaterial({color:b[3],roughness:.7}));m.castShadow=true;this.scene.add(m);return m});
  this.hd=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshStandardMaterial({color:0xe0a97c,roughness:.7}));this.hd.castShadow=true;this.scene.add(this.hd);this.face=0;this.ph=0;this.rag=this.inv=0;this.acc2=0}
 /* pose debout animée (marche / saut), dans le repère du personnage */
 pose(){const f=this.fps,s=Math.sin(this.face),c=Math.cos(this.face),am=Math.min(1,Math.hypot(f.v.x,f.v.y)/6.5),ph=this.ph,air=!f.on;
  CB.forEach((b,i)=>{let lx=b[0],ly=b[1],lz=b[2];
   if(i===11||i===13)lz+=Math.sin(ph)*(i===11?.2:.38)*am;if(i===12||i===14)lz-=Math.sin(ph)*(i===12?.2:.38)*am;
   if(i===13)ly+=Math.max(0,Math.cos(ph))*.14*am;if(i===14)ly+=Math.max(0,-Math.cos(ph))*.14*am;
   if(i===5||i===7)lz-=Math.sin(ph)*(i===5?.15:.3)*am;if(i===6||i===8)lz+=Math.sin(ph)*(i===6?.15:.3)*am;
   if(air&&i>10){lz+=i%2?.18:-.1;ly+=.12}
   this.P[i].set(f.p.x+c*lx-s*lz,f.p.y+ly,f.p.z-s*lx-c*lz)})}
 /* ragdoll : le corps garde la vitesse du joueur + l'impulsion, puis la physique (gravité, pente, obstacles, frottement) fait tout */
 startRag(sec,vx,vy,vz,force){if(this.rag>0||(!force&&this.inv>0))return false;const f=this.fps,h=1/60;this.pose();const ux=f.v.x+vx,uy=f.vy+vy,uz=f.v.y+vz;
  this.P.forEach((p,i)=>this.Q[i].set(p.x-ux*h,p.y-uy*h,p.z-uz*h));this.rag=this.rt=sec;this.acc2=0;return true}
 sim(){const P=this.P,Q=this.Q,h=1/60;
  for(let i=0;i<15;i++){const p=P[i],q=Q[i],x=p.x,y=p.y,z=p.z;p.x+=(x-q.x)*.996;p.y+=(y-q.y)*.996-22*h*h;p.z+=(z-q.z)*.996;q.set(x,y,z)}
  for(let k=0;k<8;k++){for(const[a,b,r]of this.cs){const A=P[a],B=P[b],dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,l=Math.hypot(dx,dy,dz)||1e-6,d=(l-r)/l*.5;A.x+=dx*d;A.y+=dy*d;A.z+=dz*d;B.x-=dx*d;B.y-=dy*d;B.z-=dz*d}
   for(let i=0;i<15;i++)this.col(P[i],Q[i])}}
 col(p,q){p.x=clamp(p.x,-RW+.3,RW-.3);p.z=Math.min(p.z,RZ0-.5);
  for(const b of this.boxes)if(p.x>b.x0&&p.x<b.x1&&p.z>b.z0&&p.z<b.z1&&p.y<b.y1-.15){const a=p.x-b.x0,c=b.x1-p.x,d=p.z-b.z0,e=b.z1-p.z,m=Math.min(a,c,d,e);if(m===a)p.x=b.x0;else if(m===c)p.x=b.x1;else if(m===d)p.z=b.z0;else p.z=b.z1}
  const g=this.fps.w.ground(p.x,p.z,p.y)+.08;
  if(p.y<g){const sl=(rh(p.z+.1)-rh(p.z-.1))/.2,l=Math.hypot(1,sl),ny=1/l,nz=-sl/l,d=(g-p.y)*ny;p.y+=d*ny;p.z+=d*nz;q.lerp(p,.04)}}
 stand(){const f=this.fps,h=this.P[2];f.p.set(h.x,f.w.ground(h.x,h.z,h.y),h.z);f.v.set(0,0);f.vy=0;f.on=true;this.inv=1.5;this.pose()}
 char(dt){const f=this.fps;if(this.inv>0)this.inv-=dt;
  if(this.rag>0){this.rag-=dt;this.acc2+=dt;let n=0;while(this.acc2>=1/60&&n++<5){this.acc2-=1/60;this.sim()}if(this.rag<=0){this.rag=0;this.stand()}}
  else{f.pitch=clamp(f.pitch,-.4,1.2);f.update(dt);const sp=Math.hypot(f.v.x,f.v.y);if(sp>.5)this.face=Math.atan2(-f.v.x,-f.v.y);this.ph+=sp*dt*1.5;this.pose()}
  const P=this.P,up=V3(0,1,0),d=V3(0,0,0);CN.forEach((b,i)=>{const A=P[b[0]],B=P[b[1]],m=this.bm[i];d.subVectors(B,A);const l=d.length()||1e-4;m.position.addVectors(A,B).multiplyScalar(.5);m.scale.set(b[2],l,b[2]);m.quaternion.setFromUnitVectors(up,d.divideScalar(l))});this.hd.position.copy(P[0]);
  this.camUpd(dt)}
 blocked(x,y,z){return y<rh(z)+.3||this.boxes.some(b=>x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1&&y<b.y1+.2)}
 camUpd(dt){const f=this.fps,c=this.cam,t=this.rag>0?this.P[2]:f.p,tx=t.x,ty=(this.rag>0?t.y:t.y+.9)+.8,tz=t.z,pc=clamp(f.pitch,-.4,1.2),cp=Math.cos(pc),
  dx=Math.sin(f.yaw)*cp,dy=Math.sin(pc),dz=Math.cos(f.yaw)*cp;let k=1;
  for(let s=1;s<=10;s++){const u=s*.6;if(this.blocked(tx+dx*u,ty+dy*u+.05*u,tz+dz*u)){k=(s-1)/10;break}}
  const u=6*k;c.position.lerp(V3(tx+dx*u,ty+dy*u+.3*k,tz+dz*u),1-Math.exp(-14*dt));c.lookAt(tx,ty,tz)}
 dispose(){disposeScene(this.scene)}}

/* ================= Application : manager, WIN, HUD, test, TikFinity ================= */
const renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const cv=$('#c');
const App={g:null,wins:0,cd:null,paused:false,test:false,likeAcc:0,env:null,lastN:0,locked:false,
 start(kind,col){this.stop(true);this.wins=0;this.likeAcc=0;this.cd=null;this.paused=false;this.g=kind==='g1'?new Quarry():kind==='g3'?new Ramp():new Paint(col);this.resize();
  $('#menu').classList.remove('on');$('#hud').style.display='block';$('#test').classList.add('on');$('#cross').style.display=kind==='g3'?'none':'block';this.hud();this.lockUI();ev(kind==='g1'?'Fosse aux billes lancée':kind==='g3'?'Rampe aux fruits lancée':'Bataille de peinture lancée')},
 stop(keep){if(this.g){this.g.dispose();this.g=null}Snd.vac(false);document.exitPointerLock?.();$('#hud').style.display='none';$('#cross').style.display='none';$('#lock').style.display='none';$('#cd').style.display=$('#banner').style.display='none';if(!keep)$('#menu').classList.add('on')},
 lockUI(){$('#lock').style.display=this.g&&!this.locked&&!this.paused?'block':'none'},
 resize(){renderer.setSize(innerWidth,innerHeight,false);if(this.g){this.g.cam.aspect=innerWidth/innerHeight;this.g.cam.updateProjectionMatrix()}},
 hud(){$('#wins').textContent=this.wins;$('#tgt').textContent=S.win;$$('[data-k=win]').forEach(e=>e.value=S.win)},
 changeWins(d,why){const o=this.wins;this.wins=Math.max(0,this.wins+d);this.hud();if(this.wins!==o)ev(`${this.wins-o>0?'+':''}${this.wins-o} WIN ${why||''}`);
  if(this.wins>=S.win&&this.g){this.paused=true;M.down=false;Snd.vac(false);document.exitPointerLock?.();$('#goal').classList.add('on')}},
 gift(name,qty,who){const g=findGift(name);qty=Math.max(1,+qty||1);if(!g){ev(`Cadeau ignoré : ${name}`);return}
  ev(`🎁 ${who} · ${qty}× ${g.n}`);Snd.chime();if(!this.g)return;
  if(g.w){this.changeWins(g.w*qty,`(${g.n})`);banner(`${g.w*qty>0?'+':''}${g.w*qty} WIN`)}else this.g.gift(g,qty,who)},
 /* réglage de likes commun aux 3 jeux (par palier : 1 bombe rouge (peinture), 50 billes (fosse), 10 fruits (rampe)) */
 likes(n,who){const g=this.g;if(!g)return;const t=g instanceof Paint?['lkB','lkBn','bombe(s) rouge(s)']:g instanceof Quarry?['lkM','lkMn','bille(s)']:['lkF','lkFn','fruit(s)'];
  this.likeAcc+=n;const per=Math.max(1,S[t[0]]),b=Math.floor(this.likeAcc/per);if(b>0){this.likeAcc-=b*per;const q=b*Math.max(1,S[t[1]]);g.like(q);ev(`❤ ${who} · ${n} likes → ${q} ${t[2]}`)}},
 follow(who){ev(`👤 ${who} · nouveau follow`);Snd.chime();if(this.g?.follow)this.g.follow()},
 win(dt){const g=this.g;if(g.complete()){if(this.cd==null)this.cd=10;this.cd-=dt;const n=Math.max(1,Math.ceil(this.cd)),c=$('#cd');c.style.display='block';c.textContent=n;if(n!==this.lastN){this.lastN=n;Snd.tick()}
   if(this.cd<=0){this.cd=null;c.style.display='none';this.changeWins(1,'(victoire)');banner('+1 WIN !');g.reset()}}
  else if(this.cd!=null){this.cd=null;$('#cd').style.display='none'}},
 loop(t){requestAnimationFrame(tt=>App.loop(tt));const dt=Math.min(.05,(t-(App.t||t))/1e3);App.t=t;const g=App.g;if(!g)return;
  if(!App.paused){try{g.update(dt);App.win(dt)}catch(e){console.error(e)}}
  renderer.render(g.scene,g.cam);$('#fill').style.width=(g.progress()*100)+'%';$('#lbl').textContent=g.label()}};

const apply=()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,QUAL[S.q].pr));renderer.shadowMap.enabled=QUAL[S.q].sh;Snd.vol();App.hud();App.resize()};
App.env=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;

function ev(t){const d=document.createElement('div');d.textContent=t;const e=$('#events');e.prepend(d);while(e.children.length>6)e.lastChild.remove();setTimeout(()=>d.remove(),9000)}
function banner(t){const b=$('#banner');b.textContent=t;b.style.display='block';clearTimeout(banner.h);banner.h=setTimeout(()=>b.style.display='none',2200)}

/* TikFinity : API d'événements locale ws://127.0.0.1:21213/ (TikFinity doit tourner sur le même PC).
   Les cadeaux sont reconnus automatiquement par leur nom (GIFTS) : aucune action à créer dans TikFinity. Événements : gift, like, follow. */
const HELP="échec de connexion. TikFinity tourne-t-il sur ce PC ? Une page HTTPS (GitHub Pages) peut être bloquée par le navigateur : acceptez l'autorisation « réseau local » si elle s'affiche, ou ouvrez index.html en local.";
const Conn={ws:null,want:false,n:0,gifts:0,likes:0,timer:null,
 set(c,t){$('#tk').className=c;$('#tk span').textContent='TikFinity : '+t.split('.')[0].slice(0,60);$('#cStatus').textContent=t},
 stats(){$('#cStats').textContent=`Événements reçus : ${this.n} · cadeaux : ${this.gifts} · likes : ${this.likes}`},
 go(){this.stop(true);const url=$('#cUrl').value.trim();S.url=url;S.auto=1;save();this.want=true;this.open(url)},
 open(url){clearTimeout(this.timer);this.set('wait','connexion…');let w;try{w=this.ws=new WebSocket(url)}catch(e){this.set('err','adresse invalide ('+e.message+')');return}
  const to=setTimeout(()=>{if(w.readyState!==1){this.set('err','délai dépassé : '+HELP);try{w.close()}catch{}}},6000);
  w.onopen=()=>{clearTimeout(to);this.set('ok','connecté');ev('TikFinity connecté')};
  w.onmessage=e=>this.msg(e.data);
  w.onerror=()=>{if(w.readyState!==1)this.set('err',HELP)};
  w.onclose=()=>{clearTimeout(to);if(this.ws!==w)return;if(this.want){if($('#tk').className!=='err')this.set('wait','connexion perdue, nouvelle tentative…');this.timer=setTimeout(()=>this.open(url),3000)}else this.set('','déconnecté')}},
 stop(silent){this.want=false;clearTimeout(this.timer);const w=this.ws;this.ws=null;try{w?.close()}catch{}if(!silent){S.auto=0;save()}this.set('','déconnecté')},
 msg(raw){let m;try{m=JSON.parse(raw)}catch{return}(Array.isArray(m)?m:[m]).forEach(x=>this.ev(x));this.stats()},
 ev(m){if(!m||!m.event)return;this.n++;const d=m.data||{},who=d.nickname||d.user?.nickname||d.uniqueId||d.user?.uniqueId||'Spectateur';
  if(m.event==='gift'){if(d.giftType===1&&d.repeatEnd===false)return;this.gifts++;App.gift(d.giftName||d.gift?.name,d.repeatCount||d.amount||1,who)}
  else if(m.event==='follow'){App.follow(who)}
  else if(m.event==='like'){const n=+d.likeCount||+d.count||1;this.likes+=n;App.likes(n,who)}}};

/* ================= Événements d'interface ================= */
$$('[data-k]').forEach(e=>{e.value=S[e.dataset.k];e.oninput=()=>{const k=e.dataset.k;S[k]=e.tagName==='SELECT'?e.value:(e.value===''||isNaN(+e.value)?DEF[k]:+e.value);save();apply()}});
GIFTS.forEach(g=>{const b=document.createElement('button');b.className='b';b.textContent=g.n;b.onclick=()=>App.gift(g.n,$('#tQty').value,$('#tName').value||'Testeur');$('#tGifts').append(b)});
$('#tFollow').onclick=()=>App.follow($('#tName').value||'Testeur');
$('#tLike').onclick=()=>App.likes(+$('#tLikeN').value||1,$('#tName').value||'Testeur');
const show=id=>$('#'+id).classList.add('on'),lock=()=>{try{const r=cv.requestPointerLock();r?.catch?.(()=>{})}catch{}};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;Snd.init();const a=b.dataset.a,col=b.dataset.col;
 if(col){$('#pick').classList.remove('on');App.start('g2',+col);lock()}
 else if(a==='g1'){App.start('g1');lock()}else if(a==='g3'){App.start('g3');lock()}else if(a==='g2')show('pick');else if(a==='set')show('set');else if(a==='conn')show('conn');
 else if(a==='test'){App.test=!App.test;document.body.classList.toggle('test',App.test);b.textContent='Mode test : '+(App.test?'activé':'désactivé')}
 else if(a==='close')b.closest('.pane').classList.remove('on');
 else if(a==='fs')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
 else if(a==='again'){$('#goal').classList.remove('on');const g=App.g;App.wins=0;App.paused=false;App.cd=null;g.reset();App.hud();lock()}
 else if(a==='menu'){$('#goal').classList.remove('on');App.stop()}
 else if(b.id==='back')App.stop();else if(b.id==='cGo')Conn.go();else if(b.id==='cStop')Conn.stop()});
document.addEventListener('pointerlockchange',()=>{App.locked=document.pointerLockElement===cv;if(!App.locked)M.down=false;App.lockUI()});
document.addEventListener('mousemove',e=>{const g=App.g;if(!App.locked||!g||App.paused||g.fps.rag>0)return;const k=.0022*S.sens;g.fps.yaw-=e.movementX*k;g.fps.pitch=clamp(g.fps.pitch-e.movementY*k,-1.5,1.5)});
cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;Snd.init();if(App.locked)M.down=true;else if(App.g&&!App.paused)lock()});
addEventListener('pointerup',()=>M.down=false);addEventListener('blur',()=>{M.down=false;for(const k in K)K[k]=false});cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(App.locked&&e.code==='Space')e.preventDefault();K[e.code]=true});addEventListener('keyup',e=>K[e.code]=false);
addEventListener('resize',()=>App.resize());
addEventListener('error',e=>ev('Erreur : '+e.message));
$('#cUrl').value=S.url||DEF.url;Conn.stats();Conn.set('','déconnecté');if(S.auto)Conn.go();
apply();requestAnimationFrame(t=>App.loop(t));
