  // MLow Observatory v0.5: original speculative architecture, in metres.
  // These are fictional desert settings, not reconstructions of Marfa landmarks.
  // New traits use isolated entropy; all motion is a function of UTC + seed.
  function obsPlan(hash, clock, basePlace) {
    var r = hashRng(hash, 31705), cd = CLOCK_DEFS[clock];
    var name = pickW(r, [['Existing Site', 88], ['Meridian Cloister', 4], ['Aeolian Court', 4], ['Contour Passage', 4]]);
    if ((cd.height || 5) > 12 || /Tower|Pumpjack|Windmill|Henge/.test(clock)) name = 'Existing Site';
    return { place: name === 'Existing Site' ? basePlace : name,
      bays: ri(r, 7, 13), aperture: pick(r, ['Open Arc', 'Split Horizon', 'Oculus']),
      finish: pick(r, ['Lime & Bronze', 'Caliche & Copper', 'Charcoal & Brass']),
      water: pickW(r, [['Dry Channel', 45], ['Reflecting Rill', 55]]), phase: r() * Math.PI * 2,
      features: name === 'Existing Site' ? {} : {'Architecture':name,'Aperture':null} };
  }
  function obsBevel(w,h,d,m,b) {
    b=Math.min(b || .035,w*.12,h*.12,d*.12);
    var s=new THREE.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+b,y);s.lineTo(-x-b,y);s.quadraticCurveTo(-x,y,-x,y+b);s.lineTo(-x,-y-b);s.quadraticCurveTo(-x,-y,-x-b,-y);s.lineTo(x+b,-y);s.quadraticCurveTo(x,-y,x,-y-b);s.lineTo(x,y+b);s.quadraticCurveTo(x,y,x+b,y);
    var geo=new THREE.ExtrudeBufferGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:2,curveSegments:3});geo.translate(0,0,-d/2+b);
    var o=new THREE.Mesh(geo,m);o.castShadow=o.receiveShadow=true;return o;
  }
  function obsPalette(W) {
    var a=W.P.observatory, cols=a.finish==='Charcoal & Brass'?['#53534B','#B69A65']:a.finish==='Caliche & Copper'?['#D0B894','#709C91']:['#DCD4C2','#9F784C'];
    return {wall:mtl(cols[0],'obs_lime',.86,0,2.4),edge:mtl(cols[1],'brushed',.38,.85,.65),dark:mtl('#282B28','brushed',.52,.7,.8),floor:mtl('#BBB09C','obs_limestone',.76,0,2.2)};
  }
  DETAIL_KINDS.obs_lime=function(u,v){var a=pfbm(u,v,3,317,4),b=pfbm(u,v,32,318,2),p=1-sstep(.12,.23,pfbm(u,v,64,319,1));return [.55+(a-.4)*.16+(b-.4)*.07-p*.05,.7+p*.12,.5+(a-.4)*.1+(b-.4)*.18-p*.2];};
  DETAIL_KINDS.obs_limestone=function(u,v){var a=pfbm(u,v,5,401,4),b=pfbm(u,v,40,402,1),seam=1-sstep(.005,.018,Math.min(u,1-u,v,1-v));return [.54+(a-.4)*.2-seam*.13,.64+seam*.15,.52+(b-.4)*.08-seam*.2];};
  function obsBase(W) {
    makeGround(W,'#B8A082');makeRidges(W,3800,false,'#626D72');makeRidges(W,1900,true,'#8D8776');
    W.groundAt=function(){return 0;};var F=plc_frame(W),M=obsPalette(W),R=Math.max(W.heroR+2.8,6);
    var floor=obsBevel(2*R+12,.22,2*R+14,M.floor,.04);floor.position.set(0,-.12,-2);F.g.add(floor);
    // Recessed bronze construction joints; these have thickness and catch grazing light.
    var lines=new THREE.InstancedMesh(new THREE.BoxBufferGeometry(.016,.012,2*R+13),M.edge,9);
    for(var i=0;i<9;i++)lines.setMatrixAt(i,plc_m4((i-4)*(2*R+10)/9,.006,-2));F.g.add(lines);
    W.shadowExtent=Math.max(W.shadowExtent||0,R+12);
    return {F:F,M:M,R:R};
  }
  function obsRill(W,F,M,x,z,length) {
    if(W.P.observatory.water!=='Reflecting Rill')return;
    var g=new THREE.Group(),body=obsBevel(1.1,.17,length,M.dark,.03);body.position.y=.075;g.add(body);
    var mat=new THREE.MeshStandardMaterial({color:C('#304A43'),metalness:.42,roughness:.13});
    var water=new THREE.Mesh(new THREE.PlaneBufferGeometry(.9,length-.18,12,80),mat);water.rotation.x=-Math.PI/2;water.position.y=.165;g.add(water);
    var p=water.geometry.attributes.position,base=new Float32Array(p.array);
    W.onUpdate(function(ctx){var t=ctx.utc%3600;for(var i=0;i<p.count;i++){var xx=base[i*3],yy=base[i*3+1];p.setZ(i,.009*Math.sin(yy*4+t*.7)*Math.sin(xx*7+t*.3));}p.needsUpdate=true;water.geometry.computeVertexNormals();});
    g.position.set(x,0,z);F.g.add(g);F.claimRect(x-.6,x+.6,z-length/2,z+length/2,1);
  }
  function obsCloister(W) {
    var B=obsBase(W),F=B.F,M=B.M,R=B.R,a=W.P.observatory,N=a.bays,H=Math.max(7,(CLOCK_DEFS[W.P.clock].height||4)+2),rad=R+5;
    // Open-front horseshoe, broad piers and true arched voids. The open side faces the camera (local +z).
    var width=Math.PI*rad*1.4/N*.76;
    for(var i=0;i<N;i++){
      var th=-Math.PI*.2+i/(N-1)*Math.PI*1.4,x=Math.cos(th)*rad,z=-Math.sin(th)*rad;
      var shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,H);shape.lineTo(-width/2,H);shape.closePath();
      var hole=new THREE.Path(),hw=width*.33,top=H*.65;hole.moveTo(-hw,.1);hole.lineTo(-hw,top);hole.absarc(0,top,hw,Math.PI,0,true);hole.lineTo(hw,.1);hole.closePath();shape.holes.push(hole);
      var geo=new THREE.ExtrudeBufferGeometry(shape,{depth:.7,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:20});
      var arch=new THREE.Mesh(geo,M.wall);arch.position.set(x,0,z);arch.rotation.y=Math.atan2(-x,-z);shade(arch);F.g.add(arch);F.claim(x,z,width*.6);
      var foot=obsBevel(width+.2,.2,1,M.floor,.025);foot.position.set(x,.1,z);foot.rotation.y=arch.rotation.y;F.g.add(foot);
    }
    obsRill(W,F,M,R+1,-2,R*2);obsRill(W,F,M,-R-1,-2,R*2);
    W.pick(F.g,'Meridian Cloister','Original MLow architecture: a seeded open cloister. True arched openings frame the sky; the solar angle moves the shadow intervals. '+a.bays+' bays, '+a.finish+'.');
  }
  function obsAeolian(W) {
    var B=obsBase(W),F=B.F,M=B.M,R=B.R,a=W.P.observatory,N=a.bays*3,H=6.8;
    var left=[],right=[];[-1,1].forEach(function(side){
      var cap=obsBevel(.65,.32,R*2+10,M.wall,.035);cap.position.set(side*(R+3),H,-2);F.g.add(cap);
      var sill=obsBevel(.72,.22,R*2+10,M.floor,.035);sill.position.set(side*(R+3),.12,-2);F.g.add(sill);
      for(var i=0;i<N;i++){
        var z=-R-6+i/(N-1)*(2*R+8),pivot=new THREE.Group();pivot.position.set(side*(R+3),H/2,z);
        var fin=obsBevel(.1,H-.35,.58,M.edge,.022);pivot.add(fin);F.g.add(pivot);(side<0?left:right).push(pivot);F.claim(side*(R+3),z,.45);
      }
    });
    W.onUpdate(function(ctx){var t=(ctx.utc%86400)*.09*W.windSpeed;[left,right].forEach(function(list,side){for(var i=0;i<list.length;i++)list[i].rotation.y=.42+Math.sin(t+i*.24+a.phase+side)*.65;});});
    // An open portal at the far end: slit, circular oculus, or an open arch.
    obsPortal(W,F,M,R,H,a.aperture);
    obsRill(W,F,M,-R-.9,-2,R*2);
    W.pick(F.g,'Aeolian Court','Original MLow architecture: bronze fins turn in a seeded wind wave. The opening is '+a.aperture.toLowerCase()+'. Motion is derived from scene time, so returning to a minute restores the fin positions.');
  }
  function obsPortal(W,F,M,R,H,kind) {
    var shape=new THREE.Shape(),w=R*1.35;shape.moveTo(-w,0);shape.lineTo(w,0);shape.lineTo(w,H+2);shape.lineTo(-w,H+2);shape.closePath();
    var hole=new THREE.Path();
    if(kind==='Oculus'){hole.absarc(0,H*.56,Math.min(H*.38,w*.65),0,Math.PI*2,true);}
    else {var hw=kind==='Split Horizon'?w*.7:w*.36,ht=kind==='Split Horizon'?H*.3:H*.58,bot=kind==='Split Horizon'?H*.35:.08;hole.moveTo(-hw,bot);hole.lineTo(-hw,ht+bot);if(kind==='Open Arc')hole.absarc(0,ht+bot,hw,Math.PI,0,true);else hole.lineTo(hw,ht+bot);hole.lineTo(hw,bot);hole.closePath();}
    shape.holes.push(hole);var geo=new THREE.ExtrudeBufferGeometry(shape,{depth:.9,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:3,curveSegments:36});var mesh=new THREE.Mesh(geo,M.wall);mesh.position.set(0,0,-R-8);shade(mesh);F.g.add(mesh);F.claimRect(-w,w,-R-9,-R-7,2);
  }
  function obsContour(W) {
    var B=obsBase(W),F=B.F,M=B.M,R=B.R,a=W.P.observatory,N=a.bays,H=Math.max(7,(CLOCK_DEFS[W.P.clock].height||4)+2);
    // A procession of carved portal sections behind the clock, never over a sundial.
    for(var i=0;i<N;i++){
      var w=R+4+Math.sin(i*.44+a.phase)*1.3,h=H+Math.sin(i*.36+a.phase)*1.1,z=-R-4-i*1.25;
      var sh=new THREE.Shape();sh.moveTo(-w,0);sh.lineTo(w,0);sh.lineTo(w,h);sh.quadraticCurveTo(0,h+2.6,-w,h);sh.closePath();
      var hole=new THREE.Path(),hw=w-.65;hole.moveTo(-hw,.02);hole.lineTo(-hw,h-1);hole.quadraticCurveTo(0,h+1.3,hw,h-1);hole.lineTo(hw,.02);hole.closePath();sh.holes.push(hole);
      var geo=new THREE.ExtrudeBufferGeometry(sh,{depth:.38,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,curveSegments:20}),rib=new THREE.Mesh(geo,M.wall);rib.position.z=z;shade(rib);F.g.add(rib);F.claim(-w,z,1);F.claim(w,z,1);
      var line=new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-hw,.1,z+.43),new THREE.Vector3(-hw,h-1,z+.43),new THREE.Vector3(0,h+.3,z+.43),new THREE.Vector3(hw,h-1,z+.43),new THREE.Vector3(hw,.1,z+.43)]),48,.018,5),W.glow(glowMat(palColor(W,i,N,true)||'#76C8CB',0),0,.7));F.g.add(line);
    }
    obsRill(W,F,M,R+1,-R-7,R*2);
    W.pick(F.g,'Contour Passage','Original MLow architecture: a sequence of carved limestone thresholds. Seeded section heights make a contour field in depth; restrained cyan inlays emerge after sunset.');
  }
  definePlace('Meridian Cloister',{w:0,build:obsCloister});
  definePlace('Aeolian Court',{w:0,build:obsAeolian});
  definePlace('Contour Passage',{w:0,build:obsContour});
