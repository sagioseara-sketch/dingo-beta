// 1. Import Firebase (Using ES Modules via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 2. Your Specific Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPr1ZTE5450Qv1OhF2S13h12835sodmOw",
  authDomain: "dingo-beta-c280a.firebaseapp.com",
  databaseURL: "https://dingo-beta-c280a-default-rtdb.firebaseio.com",
  projectId: "dingo-beta-c280a",
  storageBucket: "dingo-beta-c280a.firebasestorage.app",
  messagingSenderId: "842477284115",
  appId: "1:842477284115:web:613295de28df40ed2a48e6",
  measurementId: "G-K7W8YC60E2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game State Variables
let myPlayerId = Math.random().toString(36).substring(2, 9);
let roomId = "";
let playerRole = ""; 
let myBoard = []; 
let setupCounter = 1;

// UI Elements
const screens = {
    home: document.getElementById('home-screen'),
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// ==========================================
// ROOM CREATION & JOINING
// ==========================================
document.getElementById('create-btn').addEventListener('click', async () => {
    // Generate a 4-character alphanumeric room code (e.g. "A3K9")
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    roomId = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    playerRole = "p1";
    
    // Create room in Firebase
    await set(ref(db, `rooms/${roomId}`), {
        players: { p1: myPlayerId },
        gameState: { status: "waiting", currentTurn: "p1", selectedNumbers: [0], winner: "" }
    });

    document.getElementById('display-room-code').innerText = roomId;
    initSetupBoard();
    showScreen('setup');
});

document.getElementById('join-btn').addEventListener('click', async () => {
    const code = document.getElementById('room-code-input').value;
    if (!code) return;

    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists() && !snapshot.val().players.p2) {
        roomId = code;
        playerRole = "p2";
        await update(roomRef, { 'players/p2': myPlayerId });
        
        document.getElementById('display-room-code').innerText = roomId;
        initSetupBoard();
        showScreen('setup');
    } else {
        document.getElementById('home-msg').innerText = "Room full or not found!";
    }
});

// ==========================================
// SETUP PHASE (1-25)
// ==========================================
function initSetupBoard() {
    const boardDiv = document.getElementById('setup-board');
    boardDiv.innerHTML = '';
    myBoard = new Array(25).fill(null);
    setupCounter = 1;

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.addEventListener('click', () => {
            if (!cell.innerText && setupCounter <= 25) {
                cell.innerText = setupCounter;
                myBoard[i] = setupCounter;
                setupCounter++;
                if (setupCounter > 25) {
                    document.getElementById('ready-btn').disabled = false;
                }
            }
        });
        boardDiv.appendChild(cell);
    }
}

document.getElementById('ready-btn').addEventListener('click', async () => {
    // Save my board to Firebase
    await update(ref(db, `rooms/${roomId}/boards`), {
        [playerRole]: myBoard
    });
    
    // Check if both players are ready
    onValue(ref(db, `rooms/${roomId}/boards`), (snapshot) => {
        const boards = snapshot.val();
        if (boards && boards.p1 && boards.p2) {
            update(ref(db, `rooms/${roomId}/gameState`), { status: "playing" });
            startGame();
        }
    });
});

// ==========================================
// GAME PHASE
// ==========================================
function startGame() {
    showScreen('game');
    const boardDiv = document.getElementById('game-board');
    boardDiv.innerHTML = '';

    // Render Game Board
    myBoard.forEach((num) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.innerText = num;
        cell.id = `cell-${num}`;
        cell.addEventListener('click', () => handleNumberClick(num));
        boardDiv.appendChild(cell);
    });

    // Listen to Game State (The Realtime Sync)
    onValue(ref(db, `rooms/${roomId}/gameState`), (snapshot) => {
        const state = snapshot.val();
        if (!state) return;

        // Update UI based on turn
        const turnText = document.getElementById('turn-indicator');
        if (state.winner) {
            turnText.innerText = state.winner === playerRole ? "🎉 YOU WIN!" : "😢 YOU LOSE!";
            turnText.style.color = state.winner === playerRole ? "#00ffcc" : "#ff007f";
            return; // Stop game
        }

        if (state.currentTurn === playerRole) {
            turnText.innerText = "Your Turn!";
        } else {
            turnText.innerText = "Opponent's Turn...";
        }

        // Cross out selected numbers
        if (state.selectedNumbers) {
            state.selectedNumbers.forEach(num => {
                if (num !== 0) { // skip the init zero
                    const cell = document.getElementById(`cell-${num}`);
                    if (cell) cell.classList.add('crossed');
                }
            });
            
            // Check win after syncing
            checkWin(state.selectedNumbers);
        }
    });
}

async function handleNumberClick(num) {
    const stateRef = ref(db, `rooms/${roomId}/gameState`);
    const snapshot = await get(stateRef);
    const state = snapshot.val();

    // Only allow click if it's my turn, no one has won, and number isn't picked
    if (state.currentTurn === playerRole && !state.winner && !state.selectedNumbers.includes(num)) {
        const newSelected = [...(state.selectedNumbers || []), num];
        const nextTurn = playerRole === "p1" ? "p2" : "p1";

        await update(stateRef, {
            selectedNumbers: newSelected,
            currentTurn: nextTurn
        });
    }
}

// ==========================================
// WIN LOGIC (5 Lines)
// ==========================================
function checkWin(selectedNumbers) {
    const hits = myBoard.map(num => selectedNumbers.includes(num) ? 1 : 0);
    let lines = 0;

    // Rows
    for (let i = 0; i < 25; i += 5) {
        if (hits[i] && hits[i+1] && hits[i+2] && hits[i+3] && hits[i+4]) lines++;
    }
    // Columns
    for (let i = 0; i < 5; i++) {
        if (hits[i] && hits[i+5] && hits[i+10] && hits[i+15] && hits[i+20]) lines++;
    }
    // Diagonals
    if (hits[0] && hits[6] && hits[12] && hits[18] && hits[24]) lines++;
    if (hits[4] && hits[8] && hits[12] && hits[16] && hits[20]) lines++;

    if (lines >= 5) {
        // I won! Tell Firebase.
        update(ref(db, `rooms/${roomId}/gameState`), { winner: playerRole });
    }
}
