// import * as THREE from 'three';
// import React, { useRef, useState } from 'react';
// import { useFrame, ThreeElements } from '@react-three/fiber';
//
// function Box(props: ThreeElements['mesh']) {
//   const meshRef = useRef<THREE.Mesh>(null!);
//   const [hovered, setHover] = useState(false);
//   const [active, setActive] = useState(false);
//
//   // useFrame((state, delta) => (meshRef.current.rotation.x += delta));
//
//   return (
//     <mesh
//       {...props}
//       ref={meshRef}
//       scale={active ? 1.5 : 1}
//       onClick={(event) => setActive(!active)}
//       onPointerOver={(event) => setHover(true)}
//       onPointerOut={(event) => setHover(false)}
//       rotation={[0, 0, 0]}
//     >
//       <boxGeometry args={[0.3, 2, 2]} />
//       <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
//     </mesh>
//   );
// }
//
// export default Box;
