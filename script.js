import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

let roomId = "";
let player = "";
let board = [];
let crossed = [];
let timerInterval;
let time = 20;

const lines = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],
  [15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],
  [3,8,13,18,23],[4,9,14,19,24],
  [0,6,12,18,24],[4,8,12,16,20]
];

window.createRoom = function() {
  roomId = Math.random().toString(36).substring(2,7);
  player = "player1";

  set(ref(db, "rooms/" + roomId), {
    player1: true,
    player2: false,
    selected: [],
    turn: "player1",
    winner: ""
  });

  startGame();
};

window.joinRoom = function() {
  roomId = document.getElementById("roomInput").value;
  player = "player2";

  update(ref(db, "rooms/" + roomId), {
    player2: true
  });

  startGame();
};

function startGame() {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("roomCode").innerText = "Room: " + roomId;

  generateBoard();
  listenRoom();
}

function generateBoard() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  board = [];

  for (let i = 1; i <= 25; i++) {
    board.push(i);
  }

  board.sort(() => Math.random() - 0.5);

  board.forEach((num, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerText = num;
    cell.onclick = () => selectNumber(num);
    grid.appendChild(cell);
  });
}

function selectNumber(num) {
  const roomRef = ref(db, "rooms/" + roomId);

  update(roomRef, {
    selected: crossed.concat(num),
    turn: player === "player1" ? "player2" : "player1"
  });
}

function listenRoom() {
  const roomRef = ref(db, "rooms/" + roomId);

  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    crossed = data.selected || [];
    updateBoard();
    updateTurn(data.turn);
    checkWin(data.winner);
  });
}

function updateBoard() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const num = parseInt(cell.innerText);
    if (crossed.includes(num)) {
      cell.classList.add(player === "player1" ? "red" : "blue");
    }
  });
}

function updateTurn(currentTurn) {
  document.getElementById("turnText").innerText =
    currentTurn === player ? "Your Turn" : "Opponent Turn";

  if (currentTurn === player) startTimer();
}

function startTimer() {
  time = 20;
  document.getElementById("timer").innerText = time;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    time--;
    document.getElementById("timer").innerText = time;

    if (time <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

function checkWin(winner) {
  let count = 0;

  lines.forEach(line => {
    if (line.every(i => crossed.includes(board[i]))) {
      count++;
    }
  });

  if (count >= 5) {
    update(ref(db, "rooms/" + roomId), {
      winner: player
    });
    alert("You Win!");
  }

  if (winner && winner !== player) {
    alert("You Lose!");
  }
}
