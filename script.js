let droplets = 0;
let rate = 0;

let clicker = document.getElementById("clicker")
let dropdisplay = document.getElementById("dropdisplay");
let ratedisplay = document.getElementById("ratedisplay");

clicker.addEventListener("click", function() {
    droplets++;
    updatePage();
});

function updatePage() {
    dropdisplay.innerText = droplets;
    ratedisplay.innerText = rate;
}
