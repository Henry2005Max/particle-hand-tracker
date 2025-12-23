import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// --- CONFIGURATION (OPTIMIZED) ---
const PARTICLE_COUNT = 6000; // Fast and smooth
const SEPARATION = 100;

// --- STATE ---
let currentShape = 'sphere';
let isExploded = false;
let shapeIndex = 0;
const shapes = ['sphere', 'heart', 'flower', 'helix', 'saturn'];

// Audio State
let analyser, dataArray;
let isAudioActive = false;

// --- THREE.JS SETUP ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 1000;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- PARTICLES ---
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

// Initialize
for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * 2000;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 2000;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 2000;

    colors[i * 3] = 0.0;
    colors[i * 3 + 1] = 0.5;
    colors[i * 3 + 2] = 1.0;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 6, // Slightly larger particles
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- SHAPE GENERATORS ---
function setShape(type) {
    const scale = 300;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x, y, z;
        const i3 = i * 3;

        if (type === 'sphere') {
            const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
            const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
            x = scale * Math.cos(theta) * Math.sin(phi);
            y = scale * Math.sin(theta) * Math.sin(phi);
            z = scale * Math.cos(phi);
        }
        else if (type === 'heart') {
            let t = Math.PI - 2 * Math.PI * (i / PARTICLE_COUNT);
            x = 16 * Math.pow(Math.sin(t), 3);
            y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            z = (Math.random() - 0.5) * 10;
            x *= 20; y *= 20; z *= 20;
        }
        else if (type === 'flower') {
            const u = (i / PARTICLE_COUNT) * Math.PI * 16;
            const v = (i / PARTICLE_COUNT) * Math.PI * 2;
            const r = 200 * Math.sin(7 * u);
            x = r * Math.cos(u) * Math.cos(v);
            y = r * Math.cos(u) * Math.sin(v);
            z = r * Math.sin(u) + 300 * Math.cos(v);
        }
        else if (type === 'helix') {
            const t = i * 0.1;
            if (i % 2 === 0) {
                x = Math.cos(t * 0.5) * 200;
                y = (i - PARTICLE_COUNT / 2) * 0.5;
                z = Math.sin(t * 0.5) * 200;
            } else {
                x = Math.cos(t * 0.5 + Math.PI) * 200;
                y = (i - PARTICLE_COUNT / 2) * 0.5;
                z = Math.sin(t * 0.5 + Math.PI) * 200;
            }
        }
        else if (type === 'saturn') {
            if (i < PARTICLE_COUNT * 0.7) {
                const phi = Math.acos(-1 + (2 * i) / (PARTICLE_COUNT * 0.7));
                const theta = Math.sqrt((PARTICLE_COUNT * 0.7) * Math.PI) * phi;
                x = (scale * 0.8) * Math.cos(theta) * Math.sin(phi);
                y = (scale * 0.8) * Math.sin(theta) * Math.sin(phi);
                z = (scale * 0.8) * Math.cos(phi);
            } else {
                const angle = i * 0.1;
                const radius = 350 + Math.random() * 100;
                x = radius * Math.cos(angle);
                y = (Math.random() - 0.5) * 10;
                z = radius * Math.sin(angle);
                const tempY = y; const tempZ = z; const tilt = 0.4;
                y = tempY * Math.cos(tilt) - tempZ * Math.sin(tilt);
                z = tempY * Math.sin(tilt) + tempZ * Math.cos(tilt);
            }
        }

        targetPositions[i3] = x;
        targetPositions[i3 + 1] = y;
        targetPositions[i3 + 2] = z;
    }
}

setShape('sphere');

// --- AUDIO SETUP ---
document.getElementById('audio-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        isAudioActive = true;
        document.getElementById('audio-btn').style.display = 'none';
    } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Please allow microphone access to use music mode!');
    }
});

function getAverageVolume() {
    if (!isAudioActive) return 0;
    analyser.getByteFrequencyData(dataArray);
    let values = 0;
    for (let i = 0; i < dataArray.length; i++) {
        values += dataArray[i];
    }
    return values / dataArray.length;
}

// --- HAND TRACKING ---
const videoElement = document.getElementsByClassName('input_video')[0];

function onResults(results) {
    document.getElementById('loading').style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];

        const x = (0.5 - hand[8].x) * window.innerWidth * 2;
        const y = (0.5 - hand[8].y) * window.innerHeight * 2;

        // Smooth Movement
        particles.position.x += (x - particles.position.x) * 0.1;
        particles.position.y += (y - particles.position.y) * 0.1;

        // Feature: Color Shift by Position
        const hue = hand[8].x;
        material.color.setHSL(hue, 1.0, 0.5);

        // Gestures
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const pinkyTip = hand[20];
        const wrist = hand[0];

        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const pinkyDist = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);

        // Pinch = Explode
        if (pinchDist < 0.05) isExploded = true;
        else isExploded = false;

        // Fist = Change Shape
        if (pinkyDist < 0.3) {
            if (!window.shapeLock) {
                shapeIndex = (shapeIndex + 1) % shapes.length;
                setShape(shapes[shapeIndex]);
                window.shapeLock = true;
                setTimeout(() => window.shapeLock = false, 1000);
            }
        }
    }
}

const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0, // Lite mode for speed
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});

cameraUtils.start();

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    const positionsAttr = geometry.attributes.position;
    const currentPositions = positionsAttr.array;

    // Particle Morphing
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let tx = targetPositions[i3];
        let ty = targetPositions[i3 + 1];
        let tz = targetPositions[i3 + 2];

        if (isExploded) {
            tx *= 2.0; ty *= 2.0; tz *= 2.0;
        }

        currentPositions[i3] += (tx - currentPositions[i3]) * 0.1;
        currentPositions[i3 + 1] += (ty - currentPositions[i3 + 1]) * 0.1;
        currentPositions[i3 + 2] += (tz - currentPositions[i3 + 2]) * 0.1;
    }
    positionsAttr.needsUpdate = true;

    // Audio Reactivity (The "Beat")
    if (isAudioActive) {
        const volume = getAverageVolume();
        const scale = 1 + (volume / 255) * 0.8;

        // Scale particles to the beat
        particles.scale.x += (scale - particles.scale.x) * 0.1;
        particles.scale.y += (scale - particles.scale.y) * 0.1;
        particles.scale.z += (scale - particles.scale.z) * 0.1;

        // Rotate faster when loud
        particles.rotation.z += 0.001 + (volume * 0.0001);
    } else {
        // Default Rotation
        particles.rotation.y += 0.002;
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
