// @ts-nocheck
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 設定遊戲原始邏輯大小
canvas.width = 800;
canvas.height = 600;

// 📱 自動縮放 Canvas 顯示大小以符合手機螢幕
function resizeCanvas() {
  const scale = Math.min(
    window.innerWidth / canvas.width,
    window.innerHeight / canvas.height
  );

  canvas.style.width = canvas.width * scale + 'px';
  canvas.style.height = canvas.height * scale + 'px';
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // 頁面一載入就執行一次


// -------------------- 載入圖片資源 --------------------
const characterImage = new Image();
characterImage.src = 'images/character.png';

const floorImage = new Image();
floorImage.src = 'images/floor.png';

const platformImage = new Image();
platformImage.src = 'images/platform.png';

const bmwImage = new Image();
bmwImage.src = 'images/bmw.png';

const taxiImage = new Image();
taxiImage.src = 'images/taxi.png';

const spImage = new Image();
spImage.src = 'images/SP.png';

const attckImage = new Image();
attckImage.src = 'images/attck.png';

const startImage = new Image();
startImage.src = 'images/start.png';

const recoveryImage = new Image();
recoveryImage.src = 'images/dog.png';

const bossImage = new Image();
bossImage.src = 'images/boss.png';

const life3Image = new Image();
life3Image.src = 'images/3.png';

const life2Image = new Image();
life2Image.src = 'images/2.png';

const life1Image = new Image();
life1Image.src = 'images/1.png';

const leftImage = new Image();
leftImage.src = 'images/left.png';

const rightImage = new Image();
rightImage.src = 'images/right.png';

// -------------------- 音樂/音效檔 --------------------
const bgm1 = new Audio('images/bgm1.mp3');
const bgm2 = new Audio('images/bgm2.mp3');
const drg  = new Audio('images/drg.mp3');   // Boss 關卡音效
const hit  = new Audio('images/hit.mp3');   // 角色受傷音效
const heal = new Audio('images/heal.mp3');  // 回復音效

// 瀏覽器預設 loop 關閉，由程式自行控制
bgm1.loop = false;
bgm2.loop = false;
drg.loop  = false;
hit.loop  = false;
heal.loop = false;

// -------------------- BGM 循環控制邏輯 --------------------
let trackIndex   = 0;           // 0 → bgm1, 1 → bgm2
let musicTracks  = [bgm1, bgm2];
let currentMusic = null;        // 目前正在播放的 Audio 物件
let cyclePaused  = true;        // 是否暫停 BGM 循環

/**
 * 開始 BGM 循環：bgm1 → (等 5 秒) → bgm2 → (等 5 秒) → bgm1 → ...
 */
function startBgmCycle() {
  trackIndex  = 0;  // 從 bgm1 開始
  cyclePaused = false;
  playNextTrack();
}

/**
 * 播放陣列中的下一首 BGM；等待該曲結束後停 5 秒再播下一曲
 */
function playNextTrack() {
  if (cyclePaused) return; // 暫停狀態就不播放

  // 若有正在播的音樂，先停止
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.onended = null;
  }

  currentMusic = musicTracks[trackIndex];
  currentMusic.currentTime = 0;
  currentMusic.play().catch(err => console.log('BGM 播放失敗：', err));

  currentMusic.onended = () => {
    if (cyclePaused) return; // 播放途中若被暫停，就不繼續
    
    // ★ 結束後先等待 5 秒，再播下一首
    setTimeout(() => {
      if (cyclePaused) return; // 5 秒等待期間若暫停，也不播下一首
      trackIndex = (trackIndex + 1) % musicTracks.length; // 0→1→0...
      playNextTrack();
    }, 5000);
  };
}

/**
 * 暫停 BGM 循環
 */
function pauseBgmCycle() {
  cyclePaused = true;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.onended = null;
  }
}

/**
 * 恢復 BGM 循環 (從上次 trackIndex 繼續)
 */
function resumeBgmCycle() {
  cyclePaused = false;
  playNextTrack();
}

/**
 * 播放 drg.mp3，期間暫停 BGM，播放完畢後再恢復
 */
function playDrg() {
  // 1) 暫停 BGM 循環
  pauseBgmCycle();

  // 2) 播放 drg
  drg.currentTime = 0;
  drg.play().catch(err => console.log('drg 播放失敗：', err));

  // 3) drg 結束後恢復 BGM
  drg.onended = () => {
    resumeBgmCycle();
  };
}

// -------------------- 遊戲核心變數 --------------------
let score = 0;           
let lives = 3;           
let gameStarted = false;
let gameStartTime = null;
let lastRecoveryScore = 0;
let downUsed = false; // ArrowDown 每局僅一次

// Boss 出現條件
function bossShouldShow() {
  return score >= 100 && score <= 119;
}

// 虛擬控制：左右控制按鈕
let leftControlActive = false;
let rightControlActive = false;

// 角色設定
const collisionWidth = 50;
const collisionHeight = 50;
let character = {
  x: canvas.width / 2 - collisionWidth / 2,
  y: canvas.height - 150,
  width: collisionWidth,
  height: collisionHeight,
  dx: 0,
  speed: 5 * 0.85,  // 左右移動速度
  verticalSpeed: 2   // 平台下落基礎速度
};
const displayScale = 1.5;

// 平台參數
const platformWidth = 150;
const platformHeight = 20;
const floorYVal = canvas.height - 50;
const targetPlatformCount = 3;
let platforms = [];
const minDistance = 120; // 平台生成時最小間距

// -------------------- 輔助函式 --------------------
function getRect(obj) {
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
}
function getCollisionRect(obj, scale) {
  return {
    x: obj.x + (obj.width * (1 - scale)) / 2,
    y: obj.y + (obj.height * (1 - scale)) / 2,
    width: obj.width * scale,
    height: obj.height * scale
  };
}
function isColliding(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// -------------------- 平台生成 --------------------
function generateRandomObstacle() {
  if (score >= 100 && score < 110) {
    return {
      x: Math.random() * (canvas.width - platformWidth),
      y: -platformHeight - Math.random() * 50,
      width: platformWidth,
      height: platformHeight,
      type: 'special'
    };
  } else if (score >= 110) {
    let r = Math.random();
    let type = r < 1/3 ? 'bmw' : r < 2/3 ? 'taxi' : 'platform';
    return {
      x: Math.random() * (canvas.width - platformWidth),
      y: -platformHeight - Math.random() * 50,
      width: platformWidth,
      height: platformHeight,
      type: type
    };
  } else {
    let r = Math.random();
    let type;
    if (Math.random() < 0.16) {
      type = 'special';
    } else {
      type = r < 1/3 ? 'bmw' : r < 2/3 ? 'taxi' : 'platform';
    }
    return {
      x: Math.random() * (canvas.width - platformWidth),
      y: -platformHeight - Math.random() * 50,
      width: platformWidth,
      height: platformHeight,
      type: type
    };
  }
}
function generateRandomObstacleWithSpacing() {
  let newObs;
  let attempts = 0;
  do {
    newObs = generateRandomObstacle();
    let tooClose = false;
    for (let p of platforms) {
      if (p.type !== 'floor') {
        if (Math.abs(newObs.y - p.y) < minDistance) {
          tooClose = true;
          break;
        }
      }
    }
    if (!tooClose) break;
    attempts++;
  } while (attempts < 10);
  return newObs;
}
function generateRecoveryPlatform() {
  return {
    x: Math.random() * (canvas.width - platformWidth),
    y: -platformHeight - Math.random() * 50,
    width: platformWidth,
    height: platformHeight,
    type: 'recovery'
  };
}

/** 建立初始平台 **/
function createInitialPlatforms() {
  platforms = [];
  platforms.push({
    x: 0,
    y: floorYVal,
    width: canvas.width,
    height: 50,
    type: 'floor'
  });
  if (gameStartTime && Date.now() - gameStartTime >= 1500) {
    for (let i = 0; i < targetPlatformCount; i++) {
      platforms.push(generateRandomObstacleWithSpacing());
    }
  }
}

// 虛擬控制區：左右控制按鈕
function getControlZones() {
  let ctrlWidth = canvas.width * 0.15;
  let ctrlHeight = ctrlWidth;
  let leftZone = {
    x: 10,
    y: canvas.height / 2 - ctrlHeight / 2,
    width: ctrlWidth,
    height: ctrlHeight
  };
  let rightZone = {
    x: canvas.width - ctrlWidth - 10,
    y: canvas.height / 2 - ctrlHeight / 2,
    width: ctrlWidth,
    height: ctrlHeight
  };
  return { left: leftZone, right: rightZone };
}

// -------------------- 遊戲流程 --------------------
function startGame() {
  gameStarted = true;
  gameStartTime = Date.now();
  downUsed = false;
  createInitialPlatforms();

  // ★ 遊戲開始後，就啟動 bgm1→bgm2 交替播放
  startBgmCycle();
}

// 監聽鍵盤事件
let keys = {};
document.addEventListener("keydown", e => {
  keys[e.code] = true;

  // 未開始 → 按 Enter 開始
  if (!gameStarted && e.code === "Enter") {
    startGame();
  }
});

document.addEventListener("keyup", e => {
  keys[e.code] = false;
});

// Canvas 點擊 → 也可開始
canvas.addEventListener("click", () => {
  if (!gameStarted) {
    startGame();
  }
});

// 滑鼠拖曳 / 虛擬控制
let dragging = false;
let dragOffsetX = 0;
document.addEventListener("mousedown", e => {
  let rect = canvas.getBoundingClientRect();
  let clientX = e.clientX - rect.left;
  let clientY = e.clientY - rect.top;

  let displayWidth = character.width * displayScale;
  let displayHeight = character.height * displayScale;
  let charDrawX = character.x - (displayWidth - character.width) / 2;
  let charDrawY = character.y - (displayHeight - character.height);

  if (clientX >= charDrawX && clientX <= charDrawX + displayWidth &&
      clientY >= charDrawY && clientY <= charDrawY + displayHeight) {
    dragging = true;
    dragOffsetX = clientX - character.x;
  } else {
    let zones = getControlZones();
    if (clientX >= zones.left.x && clientX <= zones.left.x + zones.left.width &&
        clientY >= zones.left.y && clientY <= zones.left.y + zones.left.height) {
      leftControlActive = true;
    } else if (clientX >= zones.right.x && clientX <= zones.right.x + zones.right.width &&
               clientY >= zones.right.y && clientY <= zones.right.y + zones.right.height) {
      rightControlActive = true;
    }
  }
});

document.addEventListener("mousemove", e => {
  if (dragging) {
    let rect = canvas.getBoundingClientRect();
    let clientX = e.clientX - rect.left;
    let targetX = clientX - dragOffsetX;
    let diff = targetX - character.x;
    character.x += Math.sign(diff) * Math.min(Math.abs(diff), character.speed);
    if (character.x < 0) character.x = 0;
    if (character.x + character.width > canvas.width) {
      character.x = canvas.width - character.width;
    }
  }
});

document.addEventListener("mouseup", () => {
  dragging = false;
  leftControlActive = false;
  rightControlActive = false;
});

// 手機觸控
document.addEventListener("touchstart", e => {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = canvas.getBoundingClientRect();
  let clientX = touch.clientX - rect.left;
  let clientY = touch.clientY - rect.top;

  let displayWidth = character.width * displayScale;
  let displayHeight = character.height * displayScale;
  let charDrawX = character.x - (displayWidth - character.width) / 2;
  let charDrawY = character.y - (displayHeight - character.height);

  if (clientX >= charDrawX && clientX <= charDrawX + displayWidth &&
      clientY >= charDrawY && clientY <= charDrawY + displayHeight) {
    dragging = true;
    dragOffsetX = clientX - character.x;
  } else {
    let zones = getControlZones();
    if (clientX >= zones.left.x && clientX <= zones.left.x + zones.left.width &&
        clientY >= zones.left.y && clientY <= zones.left.y + zones.left.height) {
      leftControlActive = true;
    } else if (clientX >= zones.right.x && clientX <= zones.right.x + zones.right.width &&
               clientY >= zones.right.y && clientY <= zones.right.y + zones.right.height) {
      rightControlActive = true;
    }
  }
});

document.addEventListener("touchmove", e => {
  e.preventDefault();
  if (dragging) {
    let touch = e.touches[0];
    let rect = canvas.getBoundingClientRect();
    let clientX = touch.clientX - rect.left;
    let targetX = clientX - dragOffsetX;
    let diff = targetX - character.x;
    character.x += Math.sign(diff) * Math.min(Math.abs(diff), character.speed);
    if (character.x < 0) character.x = 0;
    if (character.x + character.width > canvas.width) {
      character.x = canvas.width - character.width;
    }
  }
});

document.addEventListener("touchend", () => {
  dragging = false;
  leftControlActive = false;
  rightControlActive = false;
});
document.addEventListener("touchcancel", () => {
  dragging = false;
  leftControlActive = false;
  rightControlActive = false;
});

// -------------------- 主更新函數 --------------------
function update() {
  if (!gameStarted) return;
  
  // 角色左右移動
  character.dx = 0;
  if (keys['ArrowLeft'])  character.dx = -character.speed;
  if (keys['ArrowRight']) character.dx =  character.speed;
  if (leftControlActive)  character.dx = -character.speed;
  if (rightControlActive) character.dx =  character.speed;
  character.x += character.dx;
  
  // 每局可用一次的 ArrowDown：+80 分
  if (keys['ArrowDown'] && !downUsed) {
    score += 80;
    downUsed = true;
    keys['ArrowDown'] = false;
  }

  // 邊界檢查
  if (character.x < 0) character.x = 0;
  if (character.x + character.width > canvas.width) {
    character.x = canvas.width - character.width;
  }
  
  // 計算平台下落速度
  let multiplier = 1;
  if (score > 25) multiplier *= 1.2;
  if (score > 50) multiplier *= 1.2;
  if (score > 75) multiplier *= 1.2;
  if (score > 100) multiplier *= 1.2;
  if (score > 150) {
    let extra = Math.floor((score - 150) / 50);
    multiplier *= Math.pow(1.2, extra);
  }
  let effectiveVerticalSpeed = character.verticalSpeed * multiplier;
  let platformDropSpeed = effectiveVerticalSpeed * 0.7 * 1.1;

  // 更新平台位置
  for (let i = 1; i < platforms.length; i++) {
    platforms[i].y += platformDropSpeed;
  }
  
  // 移除超出畫面下方的平台 → +1 分
  for (let i = platforms.length - 1; i >= 1; i--) {
    if (platforms[i].y > canvas.height) {
      platforms.splice(i, 1);
      score += 1;
    }
  }
  
  // 遊戲開始 1.5 秒後開始生成平台
  let elapsed = Date.now() - gameStartTime;
  if (elapsed >= 1500) {
    while (platforms.filter(p => p.type !== 'floor').length < targetPlatformCount) {
      platforms.push(generateRandomObstacleWithSpacing());
    }
    // 每 20 分 → 回復平台
    if (score > 0 && score % 20 === 0 && score !== lastRecoveryScore) {
      platforms.push(generateRecoveryPlatform());
      lastRecoveryScore = score;
    }
  }
  
  // Boss：在 [100,120) 顯示
  let showBoss = score >= 100 && score < 120;
  let bossImgHeight = (bossImage.naturalWidth > 0 ? bossImage.naturalHeight : 100);
  bossY = showBoss ? 20 : -bossImgHeight;
  
  // ★ 分數到 100 時，若尚未播過 drg → 暫停 BGM 播 drg (示範)
  //   只會執行一次
  if (score >= 100 && !window.drgPlayed) {
    window.drgPlayed = true;
    playDrg(); 
  }

  // 碰撞檢查
  let charRect = getRect(character);
  for (let i = platforms.length - 1; i >= 1; i--) {
    let platRect = (platforms[i].type === 'special')
      ? getCollisionRect(platforms[i], 0.8)
      : getRect(platforms[i]);

    if (isColliding(charRect, platRect)) {
      let damage = 0;
      if (platforms[i].type === 'special') {
        damage = 3;
      } else if (platforms[i].type === 'recovery') {
        // 回復音效
        if (lives < 3) {
          lives += 1;
          heal.currentTime = 0;
          heal.play().catch(err => console.log('heal 播放失敗：', err));
        }
      } else {
        damage = 1;
      }
      // [100,120) 額外 +1 傷害
      if (score >= 100 && score < 120 && damage > 0) {
        damage += 1;
      }

      // 若有傷害 → 扣血並播放 hit
      if (damage > 0) {
        lives -= damage;
        if (lives > 0) {
          hit.currentTime = 0;
          hit.play().catch(err => console.log('hit 播放失敗：', err));
        }
      }

      // 移除該平台
      platforms.splice(i, 1);

      // 命歸零 → 結束遊戲
      if (lives <= 0) {
        resetGame();
        return;
      }
    }
  }
}

// -------------------- 繪製函數 --------------------
function draw() {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (!gameStarted) {
    // 遊戲未開始 → 顯示開始畫面
    let imgWidth = canvas.width * 0.6;
    let imgHeight = imgWidth * (
      startImage.naturalWidth > 0 
        ? startImage.naturalHeight / startImage.naturalWidth 
        : 1
    );
    let imgX = (canvas.width - imgWidth) / 2;
    let imgY = (canvas.height - imgHeight) / 2;
    ctx.drawImage(startImage, imgX, imgY, imgWidth, imgHeight);
  } else {
    // Boss
    if (score >= 100 && score < 120) {
      let bossWidth = canvas.width * 0.4;
      let bossHeight = bossWidth * (
        bossImage.naturalWidth > 0 
          ? bossImage.naturalHeight / bossImage.naturalWidth 
          : 1
      );
      let bossX = (canvas.width - bossWidth) / 2;
      ctx.drawImage(bossImage, bossX, bossY, bossWidth, bossHeight);
    }
    
    // 角色
    let displayWidth  = character.width  * displayScale;
    let displayHeight = character.height * displayScale;
    let drawX = character.x - (displayWidth - character.width) / 2;
    let drawY = character.y - (displayHeight - character.height);
    ctx.drawImage(characterImage, drawX, drawY, displayWidth, displayHeight);
    
    // 平台
    platforms.forEach(platform => {
      if (platform.type === 'floor') {
        ctx.drawImage(floorImage, platform.x, platform.y, platform.width, platform.height);
      } else {
        // [100,120) → 全部顯示 attckImage
        if (score >= 100 && score < 120) {
          ctx.drawImage(attckImage, platform.x, platform.y, platform.width, platform.height);
        } else {
          if (platform.type === 'bmw') {
            ctx.drawImage(bmwImage, platform.x, platform.y, platform.width, platform.height);
          } else if (platform.type === 'taxi') {
            ctx.drawImage(taxiImage, platform.x, platform.y, platform.width, platform.height);
          } else if (platform.type === 'special') {
            ctx.drawImage(spImage, platform.x, platform.y, platform.width, platform.height);
          } else if (platform.type === 'recovery') {
            ctx.drawImage(recoveryImage, platform.x, platform.y, platform.width, platform.height);
          } else {
            ctx.drawImage(platformImage, platform.x, platform.y, platform.width, platform.height);
          }
        }
      }
    });
    
    // 虛擬左右控制區
    let zones = getControlZones();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(leftImage,  zones.left.x,  zones.left.y,  zones.left.width,  zones.left.height);
    ctx.drawImage(rightImage, zones.right.x, zones.right.y, zones.right.width, zones.right.height);
    ctx.globalAlpha = 1.0;
  }
  
  // 遊戲進行 → HUD (分數與血量)
  if (gameStarted) {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 10, 30);
    
    let lifeImg;
    if (lives >= 3) {
      lifeImg = life3Image;
    } else if (lives === 2) {
      lifeImg = life2Image;
    } else if (lives === 1) {
      lifeImg = life1Image;
    }
    if (lifeImg) {
      ctx.drawImage(lifeImg, 10, canvas.height - lifeImg.height - 10);
    }
  }
}

// -------------------- 遊戲迴圈 + 重置 --------------------
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  alert('遊戲結束！分數：' + score);

  // 歸零
  score = 0;
  lives = 3;
  keys = {};
  gameStarted = false;
  lastRecoveryScore = 0;
  downUsed = false;
  character.x = canvas.width / 2 - character.width / 2;
  character.y = canvas.height - 150;
  bossY = -(bossImage.naturalWidth > 0 ? bossImage.naturalHeight : 100);
  gameStartTime = Date.now();
  createInitialPlatforms();

  // 暫停並歸零 BGM
  pauseBgmCycle();
  trackIndex = 0;
  if (currentMusic) {
    currentMusic.currentTime = 0;
  }
}

// 初始化
function init() {
  gameStartTime = Date.now();
  createInitialPlatforms();
  gameLoop();
}

// 進入遊戲
init();
