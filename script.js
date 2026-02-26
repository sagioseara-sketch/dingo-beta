import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global State
let myUsername = "";
let roomId = "";
let playerRole = ""; 
let opponentName = "";
let myBoard = []; 
let setupCounter = 1;
let setupTimerInterval;

// Store active Firebase listeners so we can turn them off later
let unsubscribeRoom = null;
let unsubscribeGame = null;

const screens = {
    login: document.getElementById('login-screen'),
    home: document.getElementById('home-screen'),
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// ==========================================
// GAME RESET FUNCTION (THE FIX)
// ==========================================
function resetGameState() {
    // 1. Turn off old Firebase listeners
    if (unsubscribeRoom) unsubscribeRoom();
    if (unsubscribeGame) unsubscribeGame();
    unsubscribeRoom = null;
    unsubscribeGame = null;

    // 2. Wipe the game variables clean
    roomId = "";
    playerRole = "";
    opponentName = "";
    myBoard = [];
    setupCounter = 1;
    clearInterval(setupTimerInterval);

    // 3. Reset the UI buttons & text
    document.getElementById('setup-board').innerHTML = '';
    document.getElementById('game-board').innerHTML = '';
    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').innerText = "Ready";
    document.getElementById('display-room-code').innerText = "";
    document.getElementById('turn-indicator').innerText = "Waiting for opponent...";
}

// ==========================================
// 1. LOGIN SYSTEM
// ==========================================
document.getElementById('login-btn').addEventListener('click', async () => {
    const userIn = document.getElementById('username-input').value.trim();
    const passIn = document.getElementById('password-input').value.trim();
    const msg = document.getElementById('login-msg');

    if (!userIn || !passIn) {
        msg.innerText = "Please enter both username and password.";
        return;
    }

    const userRef = ref(db, `users/${userIn}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        if (snapshot.val().password === passIn) {
            loginSuccess(userIn);
        } else {
            msg.innerText = "Incorrect password!";
        }
    } else {
        await set(userRef, { password: passIn });
        loginSuccess(userIn);
    }
});

function loginSuccess(username) {
    myUsername = username;
    document.getElementById('welcome-text').innerText = `Welcome, ${myUsername}!`;
    loadHistory();
    showScreen('home');
}

// ==========================================
// 2. DASHBOARD (FIND USER & HISTORY)
// ==========================================
document.getElementById('find-user-btn').addEventListener('click', async () => {
    const searchName = document.getElementById('find-user-input').value.trim();
    const resultText = document.getElementById('find-user-result');
    if (!searchName) return;

    const snapshot = await get(ref(db, `users/${searchName}`));
    if (snapshot.exists()) {
        resultText.innerText = `✅ Player '${searchName}' exists!`;
        resultText.style.color = "#00ffcc";
    } else {
        resultText.innerText = `❌ Player not found.`;
        resultText.style.color = "#ff3333";
    }
});

function loadHistory() {
    const historyList = document.getElementById('history-list');
    onValue(ref(db, `users/${myUsername}/history`), (snapshot) => {
        historyList.innerHTML = '';
        if (snapshot.exists()) {
            const matches = snapshot.val();
            Object.values(matches).forEach(match => {
                const li = document.createElement('li');
                const resultClass = match.result === "Win" ? "win-text" : "lose-text";
                li.innerHTML = `<span class="${resultClass}">${match.result}</span> vs ${match.opponent}`;
                historyList.appendChild(li);
            });
        } else {
            historyList.innerHTML = "<li>No matches played yet.</li>";
        }
    });
}

// ==========================================
// 3. ROOM CREATION & JOINING
// ==========================================
document.getElementById('create-btn').addEventListener('click', async () => {
    resetGameState(); // Ensure clean slate before creating
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
    playerRole = "p1";
    
    await set(ref(db, `rooms/${roomId}`), {
        players: { p1: myUsername },
        gameState: { status: "waiting", currentTurn: "p1", selected: { "0": "system" }, winner: "" }
    });

    document.getElementById('display-room-code').innerText = roomId;
    initSetupBoard();
    showScreen('setup');
});

document.getElementById('join-btn').addEventListener('click', async () => {
    resetGameState(); // Ensure clean slate before joining
    const code = document.getElementById('room-code-input').value.trim();
    if (!code) return;

    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists() && !snapshot.val().players.p2) {
        roomId = code;
        playerRole = "p2";
        opponentName = snapshot.val().players.p1; 
        await update(roomRef, { [`players/p2`]: myUsername });
        
        document.getElementById('display-room-code').innerText = roomId;
        initSetupBoard();
        showScreen('setup');
    } else {
        alert("Room full or not found!");
    }
});

// ==========================================
// 4. SETUP PHASE
// ==========================================
function initSetupBoard() {
    const boardDiv = document.getElementById('setup-board');
    boardDiv.innerHTML = '';
    myBoard = new Array(25).fill(null);
    setupCounter = 1;
    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').innerText = "Ready";

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
    startSetupTimer();
}

function startSetupTimer() {
    let timeLeft = 60;
    const timerText = document.getElementById('setup-timer');
    timerText.innerText = `${timeLeft}s`;

    clearInterval(setupTimerInterval);
    setupTimerInterval = setInterval(() => {
        timeLeft--;
        timerText.innerText = `${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(setupTimerInterval);
            autoFillBoard();
            document.getElementById('ready-btn').click(); 
        }
    }, 1000);
}

function autoFillBoard() {
    const availableNumbers = [];
    for (let i = 1; i <= 25; i++) {
        if (!myBoard.includes(i)) availableNumbers.push(i);
    }
    availableNumbers.sort(() => Math.random() - 0.5);

    const cells = document.getElementById('setup-board').children;
    for (let i = 0; i < 25; i++) {
        if (myBoard[i] === null) {
            const num = availableNumbers.pop();
            myBoard[i] = num;
            cells[i].innerText = num;
        }
    }
}

document.getElementById('ready-btn').addEventListener('click', async () => {
    clearInterval(setupTimerInterval);
    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').innerText = "Waiting for Opponent...";

    await update(ref(db, `rooms/${roomId}/boards`), { [playerRole]: myBoard });
    
    // Save the listener so we can unsubscribe later
    unsubscribeRoom = onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
        const data = snapshot.val();
        if (data && data.boards && data.boards.p1 && data.boards.p2) {
            if (playerRole === "p1") opponentName = data.players.p2;
            
            update(ref(db, `rooms/${roomId}/gameState`), { status: "playing" });
            startGame();
        }
    });
});

// ==========================================
// 5. GAME PHASE & WIN CINEMATICS
// ==========================================
function startGame() {
    showScreen('game');
    const boardDiv = document.getElementById('game-board');
    boardDiv.innerHTML = '';

    myBoard.forEach((num) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.innerText = num;
        cell.id = `cell-${num}`;
        cell.addEventListener('click', () => handleNumberClick(num));
        boardDiv.appendChild(cell);
    });

    // Save the listener so we can unsubscribe later
    unsubscribeGame = onValue(ref(db, `rooms/${roomId}/gameState`), (snapshot) => {
        const state = snapshot.val();
        if (!state) return;

        const turnText = document.getElementById('turn-indicator');
        
        if (state.winner) {
            triggerEndGame(state.winner === playerRole);
            return; 
        }

        if (state.currentTurn === playerRole) {
            turnText.innerText = "Your Turn!";
            turnText.style.color = "#00ffcc";
        } else {
            turnText.innerText = `${opponentName}'s Turn...`;
            turnText.style.color = "#aaaaaa";
        }

        if (state.selected) {
            Object.keys(state.selected).forEach(numStr => {
                if (numStr !== "0") { 
                    const num = parseInt(numStr);
                    const playerWhoPicked = state.selected[numStr]; 
                    const cell = document.getElementById(`cell-${num}`);
                    if (cell) cell.classList.add(`crossed-${playerWhoPicked}`);
                }
            });
            const pickedNumbersArray = Object.keys(state.selected).map(Number);
            checkWin(pickedNumbersArray);
        }
    });
}

async function handleNumberClick(num) {
    const stateRef = ref(db, `rooms/${roomId}/gameState`);
    const snapshot = await get(stateRef);
    const state = snapshot.val();

    if (state.currentTurn === playerRole && !state.winner && !(state.selected && state.selected[num])) {
        const nextTurn = playerRole === "p1" ? "p2" : "p1";
        await update(stateRef, {
            [`selected/${num}`]: playerRole,
            currentTurn: nextTurn
        });
    }
}

function checkWin(pickedNumbersArray) {
    const hits = myBoard.map(num => pickedNumbersArray.includes(num) ? 1 : 0);
    let lines = 0;

    for (let i = 0; i < 25; i += 5) if (hits[i] && hits[i+1] && hits[i+2] && hits[i+3] && hits[i+4]) lines++;
    for (let i = 0; i < 5; i++) if (hits[i] && hits[i+5] && hits[i+10] && hits[i+15] && hits[i+20]) lines++;
    if (hits[0] && hits[6] && hits[12] && hits[18] && hits[24]) lines++;
    if (hits[4] && hits[8] && hits[12] && hits[16] && hits[20]) lines++;

    if (lines >= 5) {
        update(ref(db, `rooms/${roomId}/gameState`), { winner: playerRole });
    }
}

// ==========================================
// 6. END GAME & HISTORY RECORDING
// ==========================================
let hasRecordedHistory = false; 

async function triggerEndGame(didIWin) {
    const overlay = document.getElementById('result-overlay');
    const resultText = document.getElementById('result-text');
    
    overlay.classList.remove('hidden');

    if (didIWin) {
        resultText.innerText = "🎉 YOU WIN!";
        resultText.className = "anim-win";
    } else {
        resultText.innerText = "😢 YOU LOSE";
        resultText.className = "anim-lose";
    }

    if (!hasRecordedHistory) {
        hasRecordedHistory = true;
        await push(ref(db, `users/${myUsername}/history`), {
            opponent: opponentName,
            result: didIWin ? "Win" : "Loss"
        });
    }
}

document.getElementById('home-btn').addEventListener('click', () => {
    document.getElementById('result-overlay').classList.add('hidden');
    hasRecordedHistory = false; // reset the history lock
    resetGameState(); // WIPE EVERYTHING CLEAN
    showScreen('home');
});
                                                
