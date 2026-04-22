let droplets = 0;
let rate = 0;
let hasWon = false;
let highestDroplets = 0;
let lastSavedAt = Date.now();
let selectedDifficulty = "normal";
let challenges = getInitialChallenges();
const SAVE_KEY = "cleantap-save-v1";
const OFFLINE_PROGRESS_CAP_SECONDS = 14400;
const OFFLINE_MIN_SECONDS = 60;
const SUCCESS_SOUND_COOLDOWN_MS = 200;
const SUCCESS_SOUND_VOLUME = 0.28;

const DIFFICULTY_CONFIG = {
    easy: {
        label: "Easy",
        costMultiplier: 0.9,
        surgeChance: 0.02,
        lossChance: 0,
        winTarget: 850,
        rateMultiplier: 1.1
    },
    normal: {
        label: "Normal",
        costMultiplier: 1,
        surgeChance: 0.01,
        lossChance: 0.003,
        winTarget: 1000,
        rateMultiplier: 1
    },
    hard: {
        label: "Hard",
        costMultiplier: 1.2,
        surgeChance: 0.009,
        lossChance: 0.005,
        winTarget: 1200,
        rateMultiplier: 1
    }
};

const UPGRADE_META = {
    pump: { name: "Hand-dug Wells", unlockAt: 10 },
    crew: { name: "Drilled Wells", unlockAt: 25 },
    rig: { name: "Rainwater Catchments", unlockAt: 100 },
    gravity: { name: "Gravity Fed Systems", unlockAt: 225 },
    piped: { name: "Piped Systems", unlockAt: 450 },
    purify: { name: "Water Purification Systems", unlockAt: 900 },
    biosand: { name: "BioSand Filters", unlockAt: 1500 },
    spring: { name: "Spring Protections", unlockAt: 2600 },
    latrine: { name: "Latrines", unlockAt: 4000 }
};

const BASE_UPGRADES = {
    pump: { rateGain: 1, baseCost: 10 },
    crew: { rateGain: 5, baseCost: 50 },
    rig: { rateGain: 20, baseCost: 200 },
    gravity: { rateGain: 45, baseCost: 450 },
    piped: { rateGain: 95, baseCost: 900 },
    purify: { rateGain: 180, baseCost: 1800 },
    biosand: { rateGain: 300, baseCost: 3000 },
    spring: { rateGain: 500, baseCost: 5200 },
    latrine: { rateGain: 800, baseCost: 8000 }
};

function getInitialChallenges() {
    return {
        reached150Penalty: false
    };
}

function getInitialUpgrades() {
    let config = getDifficultyConfig();
    let result = {};

    Object.keys(BASE_UPGRADES).forEach(function(upgradeId) {
        let base = BASE_UPGRADES[upgradeId];
        result[upgradeId] = {
            rateGain: base.rateGain,
            cost: Math.ceil(base.baseCost * config.costMultiplier),
            owned: 0
        };
    });

    return result;
}

let upgrades = getInitialUpgrades();

let clicker = document.getElementById("clicker");
let infoButton = document.getElementById("info");
let donationsButton = document.getElementById("donations");
let resetGameButton = document.getElementById("reset-game");
let dropdisplay = document.getElementById("dropdisplay");
let ratedisplay = document.getElementById("ratedisplay");
let totalUpgradesOwned = document.getElementById("total-upgrades-owned");
let upgradeEmptyState = document.getElementById("upgrade-empty-state");
let difficultyDisplay = document.getElementById("difficulty-display");
let nextMilestone = document.getElementById("next-milestone");
let milestoneList = document.getElementById("milestone-list");
let milestoneLog = document.getElementById("milestone-log");
let milestoneLogToggle = document.getElementById("milestone-log-toggle");
let difficultyScreen = document.getElementById("difficulty-screen");
let difficultySummary = document.getElementById("difficulty-summary");
let continueGameButton = document.getElementById("continue-game");
let offlinePopup = document.getElementById("offline-popup");
let offlineDuration = document.getElementById("offline-duration");
let offlineEarned = document.getElementById("offline-earned");
let offlinePopupClose = document.getElementById("offline-popup-close");
let resourcePopup = document.getElementById("resource-popup");
let resourcePopupTitle = document.getElementById("resource-popup-title");
let resourcePopupText = document.getElementById("resource-popup-text");
let resourcePopupPrimary = document.getElementById("resource-popup-primary");
let resourcePopupClose = document.getElementById("resource-popup-close");
let successSound = document.getElementById("success-sound");
let resetButtons = [];
let unlockToastStack = null;
let unlockRevealState = {};
let milestoneCompletionState = {};
let suppressMilestoneSuccessSound = true;
let suppressUnlockAnnouncements = true;
let shouldShowDifficultyScreen = true;
let lastSuccessSoundAt = 0;
let quarterToastShown = false;
let halfwayToastShown = false;

const RESOURCE_POPUP_CONTENT = {
    info: {
        title: "Read More About charity: water",
        text: "Learn how charity: water partners with local experts to fund clean water, sanitation, and hygiene projects in communities around the world.",
        ctaLabel: "Learn More",
        href: "https://www.charitywater.org/our-work"
    },
    donations: {
        title: "Donate Today",
        text: "Your support helps fund sustainable clean water projects. Visit charity: water to donate and create lasting impact.",
        ctaLabel: "Donate Now",
        href: "https://www.charitywater.org/donate"
    }
};

let navItems = document.querySelectorAll(".nav-item");
let gameSections = document.querySelectorAll(".game-section");
let upgradeCards = document.querySelectorAll(".upgrade-card");
let difficultyOptions = document.querySelectorAll(".difficulty-option");
let mobileQuery = window.matchMedia("(max-width: 767px)");

function getDifficultyConfig() {
    return DIFFICULTY_CONFIG[selectedDifficulty] || DIFFICULTY_CONFIG.normal;
}

function rebuildUpgradeCostsForDifficulty() {
    let config = getDifficultyConfig();

    Object.keys(upgrades).forEach(function(upgradeId) {
        let upgrade = upgrades[upgradeId];
        let base = BASE_UPGRADES[upgradeId];

        if (!upgrade || !base) {
            return;
        }

        let cost = Math.ceil(base.baseCost * config.costMultiplier);

        for (let i = 0; i < upgrade.owned; i++) {
            cost = getNextCost(cost);
        }

        upgrade.cost = cost;
    });
}

function getComputedRateFromUpgrades() {
    let total = 0;

    Object.keys(upgrades).forEach(function(upgradeId) {
        let upgrade = upgrades[upgradeId];

        if (!upgrade) {
            return;
        }

        total += upgrade.rateGain * upgrade.owned;
    });

    return Math.floor(total * getDifficultyConfig().rateMultiplier);
}

function saveGame() {
    let payload = {
        droplets: droplets,
        rate: rate,
        highestDroplets: highestDroplets,
        lastSavedAt: Date.now(),
        difficulty: selectedDifficulty,
        hasWon: hasWon,
        challenges: challenges,
        upgrades: upgrades
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function loadGame() {
    let raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
        shouldShowDifficultyScreen = true;
        return;
    }

    try {
        let parsed = JSON.parse(raw);
        shouldShowDifficultyScreen = false;

        droplets = Number(parsed.droplets) || 0;
        highestDroplets = Number(parsed.highestDroplets) || droplets;
        lastSavedAt = Number(parsed.lastSavedAt) || Date.now();
        selectedDifficulty = parsed.difficulty || "normal";
        hasWon = Boolean(parsed.hasWon);
        challenges = Object.assign(getInitialChallenges(), parsed.challenges || {});

        let loadedUpgrades = parsed.upgrades || {};
        upgrades = getInitialUpgrades();

        Object.keys(upgrades).forEach(function(upgradeId) {
            if (!loadedUpgrades[upgradeId]) {
                return;
            }

            let loadedUpgrade = loadedUpgrades[upgradeId];
            upgrades[upgradeId].owned = Number(loadedUpgrade.owned) || 0;
        });

        rebuildUpgradeCostsForDifficulty();
        rate = getComputedRateFromUpgrades();

        let hasAnyOwnedUpgrade = Object.keys(upgrades).some(function(upgradeId) {
            return upgrades[upgradeId].owned > 0;
        });

        if (droplets <= 0 && !hasAnyOwnedUpgrade) {
            shouldShowDifficultyScreen = true;
        }
    }
    catch (error) {
        console.error("Unable to load saved game:", error);
        shouldShowDifficultyScreen = true;
    }
}

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
    let config = getDifficultyConfig();
    let randomRoll = Math.random();

    if (randomRoll < config.surgeChance) {
        droplets = Math.floor(droplets * 1.5);
        alert("Lucky surge! Your droplets were multiplied by 1.5x.");
    }
    else if (config.lossChance > 0 && randomRoll < config.surgeChance + config.lossChance) {
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
    let unlockAt = getUpgradeUnlockThreshold(upgradeId);

    if (!upgrade) {
        return;
    }

    if (highestDroplets < unlockAt) {
        showInsufficientFeedback(card);
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
    let unlockedCount = 0;

    upgradeCards.forEach(function(card) {
        let upgradeId = card.dataset.upgradeId;
        let upgrade = upgrades[upgradeId];
        let unlockAt = getUpgradeUnlockThreshold(upgradeId);
        let isUnlocked = highestDroplets >= unlockAt;

        if (!upgrade) {
            return;
        }

        if (isUnlocked && !unlockRevealState[upgradeId]) {
            unlockRevealState[upgradeId] = true;

            if (!suppressUnlockAnnouncements) {
                card.classList.remove("is-revealed");
                void card.offsetWidth;
                card.classList.add("is-revealed");
                showUnlockToast(UPGRADE_META[upgradeId].name);
            }
        }
        else if (!isUnlocked) {
            unlockRevealState[upgradeId] = false;
        }

        card.hidden = !isUnlocked;
        card.setAttribute("aria-hidden", isUnlocked ? "false" : "true");

        if (!isUnlocked) {
            return;
        }

        unlockedCount += 1;

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

    if (upgradeEmptyState) {
        upgradeEmptyState.hidden = unlockedCount > 0;
    }
}

function getUpgradeUnlockThreshold(upgradeId) {
    if (!UPGRADE_META[upgradeId]) {
        return 0;
    }

    return UPGRADE_META[upgradeId].unlockAt;
}

function ensureToastStack() {
    if (unlockToastStack) {
        return;
    }

    unlockToastStack = document.createElement("div");
    unlockToastStack.className = "unlock-toast-stack";
    document.body.appendChild(unlockToastStack);
}

function showUnlockToast(upgradeName) {
    ensureToastStack();

    let toast = document.createElement("div");
    toast.className = "unlock-toast";
    toast.innerText = "Unlocked: " + upgradeName;
    unlockToastStack.appendChild(toast);

    requestAnimationFrame(function() {
        toast.classList.add("is-visible");
    });

    setTimeout(function() {
        toast.classList.remove("is-visible");
        setTimeout(function() {
            toast.remove();
        }, 220);
    }, 1800);
}

function showProgressToast(message) {
    ensureToastStack();

    let toast = document.createElement("div");
    toast.className = "unlock-toast";
    toast.innerText = message;
    unlockToastStack.appendChild(toast);

    requestAnimationFrame(function() {
        toast.classList.add("is-visible");
    });

    setTimeout(function() {
        toast.classList.remove("is-visible");
        setTimeout(function() {
            toast.remove();
        }, 220);
    }, 1800);
}

function syncWinProgressToastFlags() {
    let winTarget = getDifficultyConfig().winTarget;
    let quarterTarget = Math.ceil(winTarget * 0.25);
    let halfTarget = Math.ceil(winTarget * 0.5);

    quarterToastShown = droplets >= quarterTarget;
    halfwayToastShown = droplets >= halfTarget;
}

function checkWinProgressToasts() {
    let winTarget = getDifficultyConfig().winTarget;
    let quarterTarget = Math.ceil(winTarget * 0.25);
    let halfTarget = Math.ceil(winTarget * 0.5);

    if (!quarterToastShown && droplets >= quarterTarget) {
        quarterToastShown = true;
        showProgressToast("Milestone: 25% of goal reached");
    }

    if (!halfwayToastShown && droplets >= halfTarget) {
        halfwayToastShown = true;
        showProgressToast("Milestone: 50% of goal reached");
    }
}

function playSuccessSound() {
    if (!successSound) {
        return;
    }

    let now = Date.now();
    if (now - lastSuccessSoundAt < SUCCESS_SOUND_COOLDOWN_MS) {
        return;
    }

    lastSuccessSoundAt = now;

    successSound.volume = SUCCESS_SOUND_VOLUME;
    successSound.currentTime = 0;
    let playPromise = successSound.play();

    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function() {
            // Ignore blocked autoplay errors until user interacts.
        });
    }
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return seconds + "s";
    }

    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let parts = [];

    if (hours > 0) {
        parts.push(hours + "h");
    }
    if (minutes > 0) {
        parts.push(minutes + "m");
    }

    if (parts.length === 0) {
        parts.push("<1m");
    }

    return parts.join(" ");
}

function showOfflinePopup(earned, awaySeconds) {
    if (!offlinePopup || !offlineDuration || !offlineEarned) {
        return;
    }

    offlineDuration.innerText = formatDuration(awaySeconds);
    offlineEarned.innerText = earned;
    offlinePopup.hidden = false;
}

function hideOfflinePopup() {
    if (!offlinePopup) {
        return;
    }

    offlinePopup.hidden = true;
}

function openResourcePopup(type) {
    let content = RESOURCE_POPUP_CONTENT[type];
    if (!content || !resourcePopup || !resourcePopupTitle || !resourcePopupText || !resourcePopupPrimary) {
        return;
    }

    resourcePopupTitle.innerText = content.title;
    resourcePopupText.innerText = content.text;
    resourcePopupPrimary.innerText = content.ctaLabel;
    resourcePopupPrimary.setAttribute("href", content.href);
    resourcePopup.hidden = false;
}

function closeResourcePopup() {
    if (!resourcePopup) {
        return;
    }

    resourcePopup.hidden = true;
}

function applyOfflineProgress() {
    let now = Date.now();
    let elapsedSeconds = Math.floor((now - lastSavedAt) / 1000);

    if (elapsedSeconds < OFFLINE_MIN_SECONDS) {
        return;
    }

    let cappedSeconds = Math.min(elapsedSeconds, OFFLINE_PROGRESS_CAP_SECONDS);
    let earned = Math.floor(rate * cappedSeconds);

    if (earned <= 0) {
        return;
    }

    droplets += earned;
    showOfflinePopup(earned, cappedSeconds);
}

function updateMilestones() {
    if (!milestoneList || !nextMilestone) {
        return;
    }

    let orderedIds = Object.keys(UPGRADE_META);
    let rows = "";
    let nextId = null;

    orderedIds.forEach(function(upgradeId) {
        if (!nextId && highestDroplets < UPGRADE_META[upgradeId].unlockAt) {
            nextId = upgradeId;
        }
    });

    orderedIds.forEach(function(upgradeId) {
        let meta = UPGRADE_META[upgradeId];
        let unlocked = highestDroplets >= meta.unlockAt;
        let statusText = unlocked ? "Completed" : "Locked";
        let statusIcon = unlocked ? "✅" : "🔒";
        let rowClass = unlocked ? "milestone-item is-unlocked" : "milestone-item is-locked";

        if (unlocked && !milestoneCompletionState[upgradeId]) {
            milestoneCompletionState[upgradeId] = true;

            if (!suppressMilestoneSuccessSound) {
                playSuccessSound();
            }
        }
        else if (!unlocked) {
            milestoneCompletionState[upgradeId] = false;
        }

        rows += "<li class='" + rowClass + "'>"
            + "<span>" + meta.name + " (" + meta.unlockAt + "+ droplets)</span>"
            + "<strong>" + statusIcon + " " + statusText + "</strong>"
            + "</li>";
    });

    if (!nextId) {
        nextMilestone.innerText = "✅ All unlock milestones complete!";
    }
    else {
        let nextMeta = UPGRADE_META[nextId];
        let dropletsRemaining = Math.max(0, nextMeta.unlockAt - highestDroplets);
        nextMilestone.innerText = "🔒 Next unlock: " + nextMeta.name + " at " + nextMeta.unlockAt + " droplets (" + dropletsRemaining + " to go).";
    }

    milestoneList.innerHTML = rows;
}

function toggleMilestoneLog() {
    if (!milestoneLog || !milestoneLogToggle) {
        return;
    }

    let isHidden = milestoneLog.hidden;
    milestoneLog.hidden = !isHidden;
    milestoneLogToggle.innerText = isHidden ? "Hide Milestone Log" : "Show Milestone Log";
    milestoneLogToggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
}

function updateDifficultyUI() {
    let config = getDifficultyConfig();

    if (difficultyDisplay) {
        difficultyDisplay.innerText = config.label;
    }

    if (difficultySummary) {
        let lossRule = config.lossChance === 0 ? "No droplet-loss event" : "Droplet-loss chance enabled";
        difficultySummary.innerText = config.label + ": goal " + config.winTarget + ", cost x" + config.costMultiplier.toFixed(2) + ", " + lossRule + ".";
    }

    difficultyOptions.forEach(function(button) {
        let isSelected = button.dataset.difficulty === selectedDifficulty;
        button.classList.toggle("is-selected", isSelected);
    });

    if (continueGameButton) {
        continueGameButton.disabled = !Boolean(selectedDifficulty);
    }
}

function setDifficulty(difficultyKey) {
    if (!DIFFICULTY_CONFIG[difficultyKey]) {
        return;
    }

    selectedDifficulty = difficultyKey;
    rebuildUpgradeCostsForDifficulty();
    rate = getComputedRateFromUpgrades();
    hasWon = false;
    syncWinProgressToastFlags();
    updateDifficultyUI();
    updatePage();
}

function closeDifficultyScreen() {
    if (!difficultyScreen) {
        return;
    }

    difficultyScreen.hidden = true;
    shouldShowDifficultyScreen = false;
}

function checkWinCondition() {
    let winTarget = getDifficultyConfig().winTarget;

    if (!hasWon && droplets >= winTarget) {
        hasWon = true;
        playSuccessSound();
        alert("You reached " + winTarget + " droplets. Congratulations, you won the game!");
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
    highestDroplets = 0;
    hasWon = false;
    challenges = getInitialChallenges();
    upgrades = getInitialUpgrades();
    quarterToastShown = false;
    halfwayToastShown = false;
    shouldShowDifficultyScreen = true;

    if (difficultyScreen) {
        difficultyScreen.hidden = false;
    }

    clearWinCelebration();
    updatePage();
}


function updatePage() {
    rate = getComputedRateFromUpgrades();

    if (droplets > highestDroplets) {
        highestDroplets = droplets;
    }

    if (dropdisplay) {
        dropdisplay.innerText = droplets;
    }
    if (ratedisplay) {
        ratedisplay.innerText = rate;
    }
    updateUpgradeCards();
    updateMilestones();
    updateDifficultyUI();
    checkWinProgressToasts();
    checkHiddenChallenges();
    checkWinCondition();

    if (dropdisplay) {
        dropdisplay.innerText = droplets;
    }

    saveGame();
    lastSavedAt = Date.now();
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

function wireResetButtons() {
    resetButtons.forEach(function(button) {
        button.addEventListener("click", resetGame);
    });
}

document.addEventListener("DOMContentLoaded", function() {
    navItems = document.querySelectorAll(".nav-item");
    gameSections = document.querySelectorAll(".game-section");
    upgradeCards = document.querySelectorAll(".upgrade-card");
    resetButtons = document.querySelectorAll(".reset-btn");
    resetGameButton = document.getElementById("reset-game");
    totalUpgradesOwned = document.getElementById("total-upgrades-owned");
    upgradeEmptyState = document.getElementById("upgrade-empty-state");
    difficultyDisplay = document.getElementById("difficulty-display");
    nextMilestone = document.getElementById("next-milestone");
    milestoneList = document.getElementById("milestone-list");
    milestoneLog = document.getElementById("milestone-log");
    milestoneLogToggle = document.getElementById("milestone-log-toggle");
    difficultyScreen = document.getElementById("difficulty-screen");
    difficultySummary = document.getElementById("difficulty-summary");
    continueGameButton = document.getElementById("continue-game");
    infoButton = document.getElementById("info");
    donationsButton = document.getElementById("donations");
    offlinePopup = document.getElementById("offline-popup");
    offlineDuration = document.getElementById("offline-duration");
    offlineEarned = document.getElementById("offline-earned");
    offlinePopupClose = document.getElementById("offline-popup-close");
    resourcePopup = document.getElementById("resource-popup");
    resourcePopupTitle = document.getElementById("resource-popup-title");
    resourcePopupText = document.getElementById("resource-popup-text");
    resourcePopupPrimary = document.getElementById("resource-popup-primary");
    resourcePopupClose = document.getElementById("resource-popup-close");
    successSound = document.getElementById("success-sound");
    difficultyOptions = document.querySelectorAll(".difficulty-option");

    loadGame();
    applyOfflineProgress();
    syncWinProgressToastFlags();

    Object.keys(UPGRADE_META).forEach(function(upgradeId) {
        unlockRevealState[upgradeId] = highestDroplets >= getUpgradeUnlockThreshold(upgradeId);
        milestoneCompletionState[upgradeId] = highestDroplets >= getUpgradeUnlockThreshold(upgradeId);
    });

    navItems.forEach(function(item) {
        item.addEventListener("click", function() {
            setActiveSection(item.dataset.target);
        });
    });

    difficultyOptions.forEach(function(optionButton) {
        optionButton.addEventListener("click", function() {
            setDifficulty(optionButton.dataset.difficulty);
        });
    });

    upgradeCards.forEach(function(card) {
        card.addEventListener("click", function() {
            buyUpgrade(card.dataset.upgradeId, card);
        });
    });

    wireResetButtons();

    if (milestoneLogToggle) {
        milestoneLogToggle.addEventListener("click", toggleMilestoneLog);
    }

    if (offlinePopupClose) {
        offlinePopupClose.addEventListener("click", hideOfflinePopup);
    }

    if (infoButton) {
        infoButton.addEventListener("click", function() {
            openResourcePopup("info");
        });
    }

    if (donationsButton) {
        donationsButton.addEventListener("click", function() {
            openResourcePopup("donations");
        });
    }

    if (resourcePopupClose) {
        resourcePopupClose.addEventListener("click", closeResourcePopup);
    }

    if (resourcePopup) {
        resourcePopup.addEventListener("click", function(event) {
            if (event.target === resourcePopup) {
                closeResourcePopup();
            }
        });
    }

    if (continueGameButton) {
        continueGameButton.addEventListener("click", closeDifficultyScreen);
    }

    syncLayoutMode();
    mobileQuery.addEventListener("change", syncLayoutMode);
    updatePage();
    suppressMilestoneSuccessSound = false;
    suppressUnlockAnnouncements = false;

    if (difficultyScreen) {
        difficultyScreen.hidden = !shouldShowDifficultyScreen;
    }

    clock();
});