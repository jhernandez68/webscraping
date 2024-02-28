import puppeteer from "puppeteer";
import fs from "fs";

async function openWebPage(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    })

    const page = await browser.newPage()

    await page.goto('https://example.com')
    await browser.close()
}

async function captureScreen(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    })

    const page = await browser.newPage()

    await page.goto('https://redzoneserver.com:7777')
    await page.screenshot({path: 'rz.png'})
    await browser.close()
}


async function navigation(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50
    })

    const page = await browser.newPage()

    await page.goto('https://quotes.toscrape.com')
    await page.click('a[href="/login"]')

    await browser.close()
}


async function navigationRedZone(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 200
    })

    const raceIds = 'race_list'
    const userLog = 'user'
    const passLog = 'pass'

    const userValue = 'webscraptest'
    const userPassword = 'dantegay'

    const loginBtn = 'login_button'

    let moreRaces = '[id="race_list 15"]';

    const page = await browser.newPage()

    await page.goto('https://redzoneserver.com:7777')
    //Click en Nick
    await page.click(`#${userLog}`)
    await page.type(`#${userLog}`, userValue);

    //Click en password
    await page.click(`#${passLog}`)
    await page.type(`#${passLog}`, userPassword);
    
    //Click a login
    await page.click(`#${loginBtn}`)
    
    //Busqueda de races
    await page.click('ul li:nth-child(9)')
    await page.click(`#${raceIds}`)

    for (let i = 0; i <= 1005; i++) {
        if (i > 0 && i % 15 == 0){
            console.log('Ampliando la lista en 15 valores, valor actual: ' + i)
            moreRaces = '[id="race_list ' + i + '"]';
            await page.click(moreRaces)
        }
    }

    const filas = await page.$$('table tr');

    let resultados = [];
    let contador = 1;

    for (const fila of filas) {
        const datosFila = await fila.$$eval('td', tds => tds.map(td => td.textContent.trim()));
        if( contador > 1 && (contador - 1) % 16 !== 0){
          resultados.push(datosFila);
        }
        contador = contador + 1;
        console.log(datosFila);
    }

    fs.writeFileSync('resultados.txt', JSON.stringify(resultados, null, 2));

    await browser.close()
}

navigationRedZone()

async function getDataFromWebPage(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    })

    const page = await browser.newPage()

    await page.goto('https://www.example.com')

    const result = await page.evaluate(() => {
        document.querySelector('h1').innerText
    })
    await browser.close()
}


async function handleDynamicWebPage() {
    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
    });
    const page = await browser.newPage();
    await page.goto("https://quotes.toscrape.com");
    const data = await page.evaluate(() => {
      const quotes = document.querySelectorAll(".quote");
      const data = [...quotes].map((quote) => {
        const quoteText = quote.querySelector(".text").innerText;
        const author = quote.querySelector(".author").innerText;
        const tags = [...quote.querySelectorAll(".tag")].map(
          (tag) => tag.innerText
        );
        return {
          quoteText,
          author,
          tags,
        };
      });
      return data;
    });
    console.log(data);
    await browser.close();
  }
  
//handleDynamicWebPage();

//openWebPage()

//captureScreen()

//navigation()

//navigationRedZone()