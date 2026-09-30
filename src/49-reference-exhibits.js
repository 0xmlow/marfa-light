  // Shared helpers from the Observatory study (v0.5): bevelled blocks and a lime finish.
  function obsBevel(w,h,d,m,b) {
    b=Math.min(b || .035,w*.12,h*.12,d*.12);
    var s=new THREE.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+b,y);s.lineTo(-x-b,y);s.quadraticCurveTo(-x,y,-x,y+b);s.lineTo(-x,-y-b);s.quadraticCurveTo(-x,-y,-x-b,-y);s.lineTo(x+b,-y);s.quadraticCurveTo(x,-y,x,-y-b);s.lineTo(x,y+b);s.quadraticCurveTo(x,y,x+b,y);
    var geo=new THREE.ExtrudeBufferGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:2,curveSegments:3});geo.translate(0,0,-d/2+b);
    var o=new THREE.Mesh(geo,m);o.castShadow=o.receiveShadow=true;return o;
  }
  DETAIL_KINDS.obs_lime=function(u,v){var a=pfbm(u,v,3,317,4),b=pfbm(u,v,32,318,2),p=1-sstep(.12,.23,pfbm(u,v,64,319,1));return [.55+(a-.4)*.16+(b-.4)*.07-p*.05,.7+p*.12,.5+(a-.4)*.1+(b-.4)*.18-p*.2];};

  // Faithful references: the viewer can attach the artist's own live renderer.
  // No copy of Snowfro's script, no sine-wave surrogate, no claim of a new Squiggle.
  var OBS_SQUIGGLES=[{id:0,type:'Normal'},{id:5,type:'Slinky'},{id:7,type:'Fuzzy'},{id:10,type:'Ribbed'},{id:20,type:'Bold'},{id:74,type:'Pipe'}];
  var OBS_REFERENCE_INFO={
    'Chromie Squiggle':{artist:'Snowfro',title:'Chromie Squiggle',url:'https://www.snowfro.com/projects/chromie-squiggle'},
    'Ringers Board':{artist:'Dmitri Cherniak',title:'Ringers',url:'https://www.artblocks.io/token/13000216'},
    'Fidenza Mural':{artist:'Tyler Hobbs',title:'Marfa Fidenza Mural',url:'https://www.shop.tylerxhobbs.com/works/2021/marfa-fidenza-mural'},
    'Archetype Stack':{artist:'Kjetil Golid',title:'Archetype',url:null},
    'Meridian Painting':{artist:'Matt DesLauriers',title:'Meridian',url:null},
    'Friendship Bracelets':{artist:'Alexis André',title:'Friendship Bracelets',url:null}
  };
  Object.keys(OBS_REFERENCE_INFO).forEach(function(name){
    var def=EGG_DEFS[name];if(!def)return;var info=OBS_REFERENCE_INFO[name];
    def.line=info.title+', by '+info.artist+'. A credited marker, not a copy. The viewer page shows the original where a verified source exists.';
    def.build=function(W){
      var p=egg2_spot(W,3.2,14,28,W.cam.dist*.75,W.cam.dist*1.3);if(!p)return;
      var g=new THREE.Group(),isSquiggle=name==='Chromie Squiggle',width=isSquiggle?5.6:2.6,height=isSquiggle?3.15:1.3,cy=isSquiggle?2.55:1.4;
      var frame=obsBevel(width+.12,height+.12,.16,mtl('#32362F','brushed',.42,.75,.8),.025);frame.position.y=cy;g.add(frame);
      var variant=OBS_SQUIGGLES[Math.floor(hashRng(W.P.hash,710)()*OBS_SQUIGGLES.length)];
      var title=isSquiggle?'CHROMIE SQUIGGLE #'+variant.id:info.title.toUpperCase();
      var label=textPlane([title,info.artist.toUpperCase(),isSquiggle?variant.type.toUpperCase()+' / ORIGINAL RENDERER':'REFERENCE / SOURCE NOTES'],{bg:'#F4F1E9',color:'#242820',font:FONT_MONO,height:height-.05,px:38,pad:.5});
      // Match the actual 16:9 display ratio, not a stretched artwork texture.
      label.scale.x=width/label.userData.w;label.position.set(0,cy,.1);g.add(label);
      [-1,1].forEach(function(side){var leg=obsBevel(.09,cy,.12,mtl('#51554B','brushed',.6,.7,.7),.01);leg.position.set(side*width*.35,cy/2,0);g.add(leg);});
      g.position.copy(p);W.face(g);shade(g);W.add(g);
      g.userData.reference={title:title,artist:info.artist,url:info.url,token:isSquiggle?variant.id:null,type:isSquiggle?variant.type:null};
      if(isSquiggle){var anchor=new THREE.Object3D();anchor.position.set(0,cy,.11);g.add(anchor);W.referenceScreens=W.referenceScreens||[];W.referenceScreens.push({anchor:anchor,width:width,height:height,reference:g.userData.reference,renderUrl:'https://www.snowfro.com/squiggle-render/index.html?animate=true&bg=0&id='+variant.id});}
    };
  });
