let droplets = 0;
let rate = 0;
let hasWon = false;
let challenges = getInitialChallenges();

function getInitialChallenges() {
    return {
        reached150Penalty: false
    };
}

function getInitialUpgrades() {
    return {
        pump: { rateGain: 1, cost: 10, owned: 0 },
        crew: { rateGain: 5, cost: 50, owned: 0 },
        rig: { rateGain: 20, cost: 200, owned: 0 }
    };
}

let upgrades = getInitialUpgrades();

let clicker = document.getElementById("clicker");
let resetGameButton = document.getElementById("reset-game");
let dropdisplay = document.getElementById("dropdisplay");
let ratedisplay = document.getElementById("ratedisplay");
let totalUpgradesOwned = document.getElementById("total-upgrades-owned");

let navItems = document.querySelectorAll(".nav-item");
let gameSections = document.querySelectorAll(".game-section");
let upgradeCards = document.querySelectorAll(".upgrade-card");
let mobileQuery = window.matchMedia("(max-width: 767px)");

if (clicker) {
    clicker.addEventListener("click", function() {
        clicker.classList.add("is-pressed");
        setTimeout(function() {
            clicker.classList.remove("is-pressed");
        }, 120);
        droplets++;
        applyRandomClickEvent();
        updatePage();
    });
}

function applyRandomClickEvent() {
    let randomRoll = Math.random();

    if (randomRoll < 0.01) {
        droplets = Math.floor(droplets * 1.5);
        alert("Lucky surge! Your droplets were multiplied by 1.5x.");
    }
    else if (randomRoll < 0.013) {
        droplets = Math.floor(droplets * 0.5);
        alert("Oh no! A spill occurred and your droplets were cut in half.");
    }
}

function getNextCost(currentCost) {
    return Math.ceil(currentCost * 1.6);
}

function showInsufficientFeedback(card) {
    if (!card) {
        return;
    }

    card.classList.remove("is-error");
    void card.offsetWidth;
    card.classList.add("is-error");

    setTimeout(function() {
        card.classList.remove("is-error");
    }, 420);
}

function buyUpgrade(upgradeId, card) {
    let upgrade = upgrades[upgradeId];

    if (!upgrade) {
        return;
    }

    if (droplets >= upgrade.cost) {
        droplets -= upgrade.cost;
        rate += upgrade.rateGain;
        upgrade.owned += 1;
        upgrade.cost = getNextCost(upgrade.cost);
        updatePage();
    }
    else {
        showInsufficientFeedback(card);
    }
}

function updateUpgradeCards() {
    let totalOwned = 0;

    upgradeCards.forEach(function(card) {
        let upgradeId = card.dataset.upgradeId;
        let upgrade = upgrades[upgradeId];

        if (!upgrade) {
            return;
        }

        let costNode = card.querySelector(".upgrade-cost");
        let ownedNode = card.querySelector(".upgrade-owned");
        let rateNode = card.querySelector(".upgrade-rate");

        if (costNode) {
            costNode.innerText = upgrade.cost;
        }

        if (ownedNode) {
            ownedNode.innerText = upgrade.owned;
        }

        if (rateNode) {
            rateNode.innerText = upgrade.rateGain;
        }

        totalOwned += upgrade.owned;
    });

    if (totalUpgradesOwned) {
        totalUpgradesOwned.innerText = totalOwned;
    }
}

function checkWinCondition() {
    if (!hasWon && droplets >= 1000) {
        hasWon = true;
        alert("You reached 1000 droplets. Congratulations, you won the game!");
        triggerWinCelebration();
    }
}

function clearWinCelebration() {
    let activeLayer = document.querySelector(".win-confetti-layer");
    if (activeLayer) {
        activeLayer.remove();
    }
}

function triggerWinCelebration() {
    clearWinCelebration();

    let layer = document.createElement("div");
    let emojis = ["🎉", "✨", "💧", "🥳", "🎊", "💙", "🌟"];
    layer.className = "win-confetti-layer";

    for (let i = 0; i < 52; i++) {
        let drop = document.createElement("span");
        let duration = 2800 + Math.random() * 2200;
        let delay = Math.random() * 700;
        let size = 1 + Math.random() * 1.3;

        drop.className = "confetti-emoji";
        drop.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        drop.style.left = (Math.random() * 100).toFixed(2) + "%";
        drop.style.animationDuration = duration.toFixed(0) + "ms";
        drop.style.animationDelay = delay.toFixed(0) + "ms";
        drop.style.fontSize = size.toFixed(2) + "rem";
        layer.appendChild(drop);
    }

    document.body.appendChild(layer);

    setTimeout(function() {
        layer.remove();
    }, 6200);
}

function checkHiddenChallenges() {
    if (!challenges.reached150Penalty && droplets >= 150) {
        challenges.reached150Penalty = true;
        droplets = Math.floor(droplets * 0.5);
        alert("Hidden challenge triggered! You reached 150 droplets and lost half your droplets.");
    }
}

function resetGame() {
    let shouldReset = confirm("Reset game? This will clear all droplets and upgrades.");

    if (!shouldReset) {
        return;
    }

    droplets = 0;
    rate = 0;
    hasWon = false;
    challenges = getInitialChallenges();
    upgrades = getInitialUpgrades();
    clearWinCelebration();
    updatePage();
}


function updatePage() {
    if (dropdisplay) {
        dropdisplay.innerText = droplets;
    }
    if (ratedisplay) {
        ratedisplay.innerText = rate;
    }
    updateUpgradeCards();
    checkHiddenChallenges();
    checkWinCondition();

    if (dropdisplay) {
        dropdisplay.innerText = droplets;
    }
}

function setActiveSection(sectionId) {
    let isMobile = mobileQuery.matches;

    gameSections.forEach(function(section) {
        let isTarget = section.id === sectionId;
        if (isMobile) {
            section.classList.toggle("is-active", isTarget);
            section.hidden = !isTarget;
            section.classList.remove("section-enter");
            if (isTarget) {
                void section.offsetWidth;
                section.classList.add("section-enter");
            }
        }
        else {
            section.classList.add("is-active");
            section.hidden = false;
            section.classList.remove("section-enter");
        }
    });

    navItems.forEach(function(item) {
        let isTarget = item.dataset.target === sectionId;
        item.classList.toggle("is-active", isTarget);
        item.setAttribute("aria-current", isTarget ? "page" : "false");
    });
}

function syncLayoutMode() {
    if (mobileQuery.matches) {
        let current = document.querySelector(".nav-item.is-active");
        let target = current ? current.dataset.target : "home";
        setActiveSection(target);
    }
    else {
        setActiveSection("home");
    }
}

function clock() {
    droplets += rate;
    updatePage();
    setTimeout(clock, 1000);
}

document.addEventListener("DOMContentLoaded", function() {
    navItems = document.querySelectorAll(".nav-item");
    gameSections = document.querySelectorAll(".game-section");
    upgradeCards = document.querySelectorAll(".upgrade-card");
    resetGameButton = document.getElementById("reset-game");
    totalUpgradesOwned = document.getElementById("total-upgrades-owned");

    navItems.forEach(function(item) {
        item.addEventListener("click", function() {
            setActiveSection(item.dataset.target);
        });
    });

    upgradeCards.forEach(function(card) {
        card.addEventListener("click", function() {
            buyUpgrade(card.dataset.upgradeId, card);
        });
    });

    if (resetGameButton) {
        resetGameButton.addEventListener("click", resetGame);
    }

    syncLayoutMode();
    mobileQuery.addEventListener("change", syncLayoutMode);
    updatePage();
    clock();
});