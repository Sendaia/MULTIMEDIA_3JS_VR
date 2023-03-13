import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

let container;
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let skinnedMesh, skeleton, bones, skeletonHelper;
let theta = 0;
let intersectObject;
let notSelected = new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
let raycaster;
const pointer = new THREE.Vector2();
let dragObject;
let intersectPoint;
let currentDiff = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
const group = new THREE.Group();
const intersected = [];
const tempMatrix = new THREE.Matrix4();

let radius = 20;         
init();
animate();

function init() {
    container = document.createElement( 'div' );
    document.body.appendChild( container );
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x808080 );
    let dirLight = new THREE.DirectionalLight ( 0xffffff, 0.5 );
    scene.add( dirLight );
        
    let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.3 );
    scene.add( hemiLight );
    
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.z = 60;
    
    raycaster = new THREE.Raycaster();

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );

    document.body.appendChild( VRButton.createButton( renderer ) );

    controller1 = renderer.xr.getController( 0 );
    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );
    scene.add( controller2 );

    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    const geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );
    const line = new THREE.Line( geometry );
    line.name = 'line';
    line.scale.z = 5;

    controller1.add( line.clone() );
    controller2.add( line.clone() );


    const aBoxGeometry = new THREE.BoxGeometry( 10, 3, 10 );
     // creando un nuevo grupo
    
    for (var i = 0; i < 5; i++) {
        let anIntersectableObject;
        const material = new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
        anIntersectableObject = new THREE.Mesh( aBoxGeometry, material );
        anIntersectableObject.position.set(0, -12 + (i*6), 0);
        anIntersectableObject.isDraggable = true;
        anIntersectableObject.currentDrag = false;
        anIntersectableObject.interactive = true;
        group.add( anIntersectableObject ); // agregando cada objeto al grupo
    }
    
    // agregando el grupo a la escena
    scene.add(group);


    window.addEventListener( 'resize', onWindowResize );
    //window.addEventListener( 'pointerdown', onPointerDown );
    //window.addEventListener( 'pointerup', onPointerUp );
    //window.addEventListener( 'mousemove', onPointerMove );
    // window.addEventListener( 'onSelectStart', onPointerDown );
    // window.addEventListener( 'onSelectEnd', onPointerUp );
    initSkinnedMesh();
    for (let i = 0; i < group.children.length; i++) {
        console.log(skeleton.bones[i].position)
    }
}

function initSkinnedMesh() {

    const segmentHeight = 6;
    const segmentCount = 4;
    const height = segmentHeight * segmentCount;
    const halfHeight = height * 0.5;

    const sizing = {
            segmentHeight,
            segmentCount,
            height,
            halfHeight
    };

    const geometry = createGeometry( sizing );
    
    const material = new THREE.MeshStandardMaterial( {
            color: 0x156289,
           emissive: 0x072534,
            side: THREE.DoubleSide,
            flatShading: true,
            wireframe: true
    } );


    const bones = createBones( sizing );
    skeleton = new THREE.Skeleton( bones );
    skinnedMesh = new THREE.SkinnedMesh( geometry, material );
    const rootBone = skeleton.bones[ 0 ];
    skinnedMesh.add( rootBone );
    skinnedMesh.bind( skeleton );
    scene.add( skinnedMesh );
    skeletonHelper = new THREE.SkeletonHelper( skinnedMesh );
    skeletonHelper.material.linewidth = 5;
    scene.add( skeletonHelper );

}

function createGeometry( sizing ) {

    const geometry = new THREE.CylinderGeometry(
            5, // radiusTop
            5, // radiusBottom
            sizing.height, // height
            8, // radiusSegments
            sizing.segmentCount * 1, // heightSegments
            true // openEnded
    );

    const position = geometry.attributes.position;

    const vertex = new THREE.Vector3();

    const skinIndices = [];
    const skinWeights = [];

    for ( let i = 0; i < position.count; i ++ ) {

            vertex.fromBufferAttribute( position, i );

            const y = ( vertex.y + sizing.halfHeight );

            const skinIndex = Math.floor( y / sizing.segmentHeight );
            const skinWeight = ( y % sizing.segmentHeight ) / sizing.segmentHeight;

            skinIndices.push( skinIndex, skinIndex + 1, 0, 0 );
            skinWeights.push( 1 - skinWeight, skinWeight, 0, 0 );

    }

    geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
    geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );

    return geometry;

    }

function createBones( sizing ) {

    bones = [];

    let prevBone = new THREE.Bone();
    bones.push( prevBone );
    prevBone.position.y = - sizing.halfHeight;

    for ( let i = 0; i < sizing.segmentCount; i ++ ) {

            const bone = new THREE.Bone();
            bone.position.y = sizing.segmentHeight;
            //console.log(bone.position.y)
            bones.push( bone );
            prevBone.add( bone );
            prevBone = bone;

    }
    return bones;
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );

}

// function onPointerMove (event){
//     pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
//     pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
//     raycaster.setFromCamera(pointer, camera);
    
//     const found = raycaster.intersectObjects(scene.children, true);
    
//     if (found.length) {
        
//         if(found[0].object.interactive){
//             if(intersectObject != found[0].object){
//                 if(intersectObject){
//                     intersectObject.material.emissive.setHex(notSelected.emissive.getHex()) //quitar luz
//                 };
//                 intersectObject = found[0].object;
//                 found[0].object.material.emissive.setHex(0xff0000); //poner luz
//             }
//         }
//         if (found[0].object.currentDrag){
//             intersectPoint = found[0].point;
//             dragObject.position.set(intersectPoint.x,intersectPoint.y,0);
//             for (let i = 0; i < group.children.length; i++) {
//                 if(group.children[i] == dragObject){
//                     //skeleton.bones[i].position.copy(group.children[i].sposition);
//                     if(i > 0){
//                         currentDiff[i] = {x: group.children[i].position.x - group.children[i-1].position.x, y: group.children[i].position.y - group.children[i-1].position.y}
//                         skeleton.bones[i].position.y = group.children[i].position.y + 18 - (6*i);// - //group.children[0].position.y;
//                         skeleton.bones[i].position.x = group.children[i].position.x;// - group.children[0].position.x;
//                         break;
//                     }else{
//                         //currentDiff[0] = {x: group.children[i].position.x - group.children[i].position.x, y: group.children[i].position.y - group.children[i-1].position.y}
//                         skeleton.bones[i].position.y = group.children[i].position.y;
//                         //dragObject.position.set(intersectPoint.x,intersectPoint.y,0);
//                         skeleton.bones[i].position.x = group.children[i].position.x;
//                     }
//                     //console.log(intersectPoint);
//                     // for(let j = i+1; j < group.children.length; j++){

//                     //     group.children[j].position.y = 16//skeleton.bones[j].position.y + (6*j) - 18 + intersectPoint.y;
//                     //     group.children[j].position.x = skeleton.bones[j].position.x + intersectPoint.x;

//                     // }
//                 }
//             }

//         }
//     }else {
//         if ( intersectObject ) intersectObject.material.emissive.setHex(notSelected.emissive.getHex); //quitar luz
//         intersectObject = null;
//     }
    
// }

// function onPointerDown( event ) {

//     pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
//     pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
//     raycaster.setFromCamera(pointer, camera);
    
//     const found = raycaster.intersectObjects(scene.children, true);
    
//     if (found.length) {
//         if(found[0].object.isDraggable){
//             found[0].object.currentDrag = true;
//             dragObject = found[0].object;
//         }

//     }

// }

// function onPointerUp( event ) {
//     dragObject.currentDrag = false;
// }


function onSelectStart( event ) {

    const controller = event.target;

    const intersections = getIntersections( controller );

    if ( intersections.length > 0 ) {

            const intersection = intersections[ 0 ];

            const object = intersection.object;
            object.material.emissive.b = 1;
            controller.attach( object );

            controller.userData.selected = object;

    }

}

function onSelectEnd( event ) {

    const controller = event.target;

    if ( controller.userData.selected !== undefined ) {

            const object = controller.userData.selected;
            object.material.emissive.b = 0;
            group.attach( object );

            controller.userData.selected = undefined;

    }


}

function getIntersections( controller ) {

    tempMatrix.identity().extractRotation( controller.matrixWorld );

    raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
    raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );

    return raycaster.intersectObjects( group.children, false );

}

function intersectObjects( controller ) {

    // Do not highlight when already selected

    if ( controller.userData.selected !== undefined ) return;

    const line = controller.getObjectByName( 'line' );
    const intersections = getIntersections( controller );

    if ( intersections.length > 0 ) {

            const intersection = intersections[ 0 ];

            const object = intersection.object;
            object.material.emissive.r = 1;
            intersected.push( object );

            line.scale.z = intersection.distance;

    } else {

            line.scale.z = 5;

    }

}

function cleanIntersected() {

    while ( intersected.length ) {

            const object = intersected.pop();
            object.material.emissive.r = 0;

    }

}

function animate() {
    theta += 4;
    //aMovingObject.position.y = radius * Math.sin( THREE.MathUtils.degToRad( theta ) );
    requestAnimationFrame(animate);

    //  skeleton.bones[ 0 ].position.x = radius * Math.sin( THREE.MathUtils.degToRad( theta ) );
    //  skeleton.bones[ 1 ].rotation.y = radius * Math.sin( THREE.MathUtils.degToRad( theta ) );
//     skeleton.bones[ 2 ].position.x += 0.04;
//     skeleton.bones[ 3 ].position.z += 0.04;
//     skeleton.bones[ 4 ].rotation.z += 0.04;

    // for (let i = 0; i < group.children.length; i++) {
    //     // hacer algo con cada objeto en el grupo
    //     //console.log(group.children[i].position);
    //     //group.children[i].position.copy(skeleton.bones[i].position);
    //     // if(i > 0){
    //     //     group.children[i].position.y = -18 + (6*i) + skeleton.bones[i].position.y;
    //     //     group.children[i].position.x = skeleton.bones[i].position.x;
    //     // }else{
    //     //     group.children[i].position.y = skeleton.bones[i].position.y;
    //     //     group.children[i].position.x = skeleton.bones[i].position.x;
    //     // }

    //     //.copy(group.children[i].position);
    // }

    for (let i = 0; i < group.children.length; i++) {
        if(group.children[i] == dragObject){
            //skeleton.bones[i].position.copy(group.children[i].sposition);
            // if(i > 0){
            //     skeleton.bones[i].position.y = group.children[i].position.y + 18 - (6*i);
            //     skeleton.bones[i].position.x = group.children[i].position.x;
            // }else{
            //     skeleton.bones[i].position.y = group.children[i].position.y;
            //     skeleton.bones[i].position.x = group.children[i].position.x;
            // }
            //console.log(intersectPoint);
            for(let j = i+1; j < group.children.length; j++){
                group.children[j].position.y = group.children[j-1].position.y + 6 + currentDiff[j].y;
                group.children[j].position.x = group.children[j-1].position.x + currentDiff[j].x;

            }
        }
    }
    //renderer.render( scene, camera );
    renderer.setAnimationLoop( render );


}

function render() {

    cleanIntersected();

    intersectObjects( controller1 );
    intersectObjects( controller2 );

    renderer.render( scene, camera );

}