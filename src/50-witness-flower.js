  // MLow's own witness, not an Art Blocks reference. Broad bone petals and a blue eye.
  // The bloom opens with solar elevation; no frame-history accumulation.
  EGG_DEFS['First Eye Flower'].line='MLow’s Eye Flower: six bone-white petals around a blue iris. The bloom opens with the sun and folds after dark.';
  EGG_DEFS['First Eye Flower'].build=function(W){
    var p=egg2_spot(W,1.6,12,25,W.cam.dist*.6,W.cam.dist*1.05);if(!p)return;
    var g=new THREE.Group(),H=3.3,stem=mtl('#405951','plaster',.77,0,.7),bone=mtl('#E4E1D4','obs_lime',.58,0,.6);
    var path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(-.18,1.1,0),new THREE.Vector3(.15,2.4,.02),new THREE.Vector3(0,H,0)]);
    var stalk=new THREE.Mesh(new THREE.TubeBufferGeometry(path,40,.05,10),stem);g.add(stalk);
    var head=new THREE.Group();head.position.y=H;g.add(head);head.rotation.y=Math.atan2(W.cam.pos.x-p.x,W.cam.pos.z-p.z);
    var sh=new THREE.Shape();sh.moveTo(0,.08);sh.bezierCurveTo(-.24,.22,-.55,.72,-.27,1.04);sh.bezierCurveTo(-.1,1.23,.23,1.15,.33,.94);sh.bezierCurveTo(.49,.61,.2,.21,0,.08);
    var geo=new THREE.ExtrudeBufferGeometry(sh,{depth:.035,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,curveSegments:18});
    var v=geo.attributes.position;for(var i=0;i<v.count;i++)v.setZ(i,v.getZ(i)+.16*Math.sin(v.getY(i)*Math.PI));geo.computeVertexNormals();
    var petals=[];
    for(var k=0;k<6;k++){var joint=new THREE.Group();joint.rotation.z=k*Math.PI/3;var pet=new THREE.Mesh(geo,bone);joint.add(pet);head.add(joint);petals.push(pet);
      // Cobalt paint follows the petal's curvature, with breathing room at the edge.
      var pts=[];for(var j=0;j<20;j++){var y=.24+j/19*.75;pts.push(new THREE.Vector3(Math.sin(y*9+k)*.045,y,.16*Math.sin(y*Math.PI)+.065));}
      var vein=new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(pts),30,.006,4),std('#5A729C',.68));pet.add(vein);
    }
    var irisTex=eyeTexture(),iris=new THREE.Mesh(new THREE.SphereBufferGeometry(.3,40,24),new THREE.MeshStandardMaterial({map:irisTex,roughness:.19,metalness:0}));iris.scale.z=.52;iris.position.z=.15;head.add(iris);
    [-1,1].forEach(function(side){var leaf=new THREE.Mesh(geo,stem);leaf.scale.set(.5,.6,.7);leaf.position.set(0,1.1+(side>0?.55:0),0);leaf.rotation.z=side*1.1;leaf.rotation.y=side*.7;g.add(leaf);});
    g.position.copy(p);shade(g);W.add(g);W.onUpdate(function(ctx){var open=sstep(-8,14,ctx.sun.el);for(var j=0;j<petals.length;j++)petals[j].rotation.x=.08+(1-open)*.93;stalk.rotation.z=Math.sin(ctx.utc*.23+W.P.seed)*.012*W.windSpeed;});
    W.pick(g,'Eye Flower / MLow','An original MLow witness. Bone petals carry cobalt veins; its opening follows solar elevation in Marfa.');
  };
