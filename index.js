let stage = document.querySelector(".stage");
let man = document.querySelector(".stage .man");
//set the topic
let topicSpan = document.querySelector(".topic span");
let categories = {
    animals: ["dog", "cat", "whale", "snake", "bear", "fish"],
    people: ["leonardo decabreo", "al patcino", "tom hanks", "tom hardy", "brad beat"],
    countries: ["syria", "egypt", "jordon", "lebanon", "usa"],
}
// fetch("/index.json").then(request => {
//     console.log(request);
//     let r = request.json();
//     console.log(r);
//     return r;
// }).then(res => {
//     let categories = res;
//     let allKeys = Object.keys(categories);
//     let randomKey = allKeys[Math.floor(Math.random() * allKeys.length)]; 
//     let randomValue = Math.floor(Math.random() * categories[`${randomKey}`].length);
//     mainWord = categories[`${randomKey}`][randomValue];
//     topicSpan.innerHTML = randomKey;
// })

let allKeys = Object.keys(categories);
let randomKey = allKeys[Math.floor(Math.random() * allKeys.length)]; 
let randomValue = Math.floor(Math.random() * categories[`${randomKey}`].length);
mainWord = categories[`${randomKey}`][randomValue];
topicSpan.innerHTML = randomKey;

//Get Random Topics of Litters 
let letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
let containerLetters = document.querySelector(".lettersCon");
letters.forEach(letter => {
    let span = document.createElement("span");
    span.innerHTML = letter.toLowerCase();
    span.className = "letter-box";
    containerLetters.append(span);
})
//Status of Choosing Letter
let satus = false;
//Number of wrong Elements
let wrongNum = 0;
//Number of Right Element
let rightNum = 0;
//select the parts of man
let head = document.querySelector(".head");
let body = document.querySelector(".body");
let handF = document.querySelector(".hands .first");
let handS = document.querySelector(".hands .second");
let legF = document.querySelector(".legs .first");
let legS = document.querySelector(".legs .second");
//Creat the Gussing Spans
let gussingSec = document.querySelector(".gussing");

let arrOfMainWord = mainWord.split("");
arrOfMainWord.forEach(letter => {
    let span = document.createElement("span");
    if (letter == " ") {
        span.className = "letter-space";
    }
    else span.className = "letter-no";
    gussingSec.append(span);
});
let arrOfSpans = Array.from(gussingSec.children);
console.log(mainWord);
//Click On letters 
document.addEventListener("click", ev => {
    if (ev.target.className == "letter-box") {
        satus = false;
        ev.target.classList.add("clicked");
        arrOfMainWord.forEach((el, index) => {
            let clickedLetter = ev.target.innerHTML;
            if (clickedLetter == el) {
                satus = true;
                arrOfSpans[index].innerHTML = ev.target.innerHTML
            }
        });
        if (satus == false) {
            wrongNum++;
            stage.classList.add(`wrong-${wrongNum}`);
            // document.getElementById("fail").play();
            if (wrongNum == 6) {
                let popUp = document.createElement("div");
                let pop = document.createElement("div");
                let buttReplay = document.createElement("div");
                buttReplay.innerHTML = "Play Again!"
                buttReplay.className = "buttRe";
                pop.className = "pop";
                popUp.appendChild(pop);
                pop.innerHTML = "Game Over"
                popUp.className = "popFailed";
                document.body.appendChild(popUp);
                pop.appendChild(buttReplay);
            }
        }
        else {
            // document.getElementById("success").play();
            rightNum = 0;
            arrOfSpans.forEach(span => {
                if (/[a-zA-Z]/gi.test(span.innerHTML)) rightNum++;
            })
            let letterNo = document.querySelectorAll(".letter-no").length;
            if (rightNum == letterNo) {
                let popUp = document.createElement("div");
                let pop = document.createElement("div");
                let buttReplay = document.createElement("div");
                buttReplay.innerHTML = "Play Again!"
                buttReplay.className = "buttRe";
                pop.className = "pop";
                popUp.appendChild(pop);
                pop.innerHTML = "You Are A Winner!!!";
                popUp.className = "popSucces";
                document.body.appendChild(popUp);
                pop.appendChild(buttReplay);
            }
            
            
        }
        }
        
    
});
document.addEventListener("click", ev => {
    if (ev.target.className == "buttRe") {
        window.location.reload();
    }
})
