import puppeteer from "puppeteer";
import fs from "fs";

async function openWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    });

    const page = await browser.newPage();

    await page.goto("https://example.com", {
        waitUntil: "domcontentloaded"
    });

    await browser.close();
}

async function captureScreen() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    });

    const page = await browser.newPage();

    await page.goto("https://redzoneserver.com:7777", {
        waitUntil: "domcontentloaded"
    });

    await page.screenshot({ path: "rz.png" });
    await browser.close();
}

async function navigation() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50
    });

    const page = await browser.newPage();

    await page.goto("https://quotes.toscrape.com", {
        waitUntil: "domcontentloaded"
    });

    await page.click('a[href="/login"]');
    await browser.close();
}

async function clickVisibleByText(page, text) {
    await page.waitForFunction(
        text => {
            const elements = [...document.querySelectorAll("a, button, li")];

            return elements.some(element => {
                const content = element.textContent
                    ?.replace(/\s+/g, " ")
                    .trim();

                return content?.includes(text) &&
                    element.offsetParent !== null;
            });
        },
        {
            timeout: 15000
        },
        text
    );

    const clicked = await page.evaluate(text => {
        const elements = [...document.querySelectorAll("a, button, li")];

        const element = elements.find(element => {
            const content = element.textContent
                ?.replace(/\s+/g, " ")
                .trim();

            return content?.includes(text) &&
                element.offsetParent !== null;
        });

        if (!element) {
            return false;
        }

        const clickable = element.matches("a, button")
            ? element
            : element.querySelector("a, button") || element;

        clickable.click();

        return true;
    }, text);

    if (!clicked) {
        throw new Error(`No se pudo hacer click en: ${text}`);
    }
}

async function navigationRedZone() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 200
    });

    try {
        const raceIds = "race_list";
        const userLog = "user";
        const passLog = "pass";
        const loginBtn = "login_button";

        const userValue = "webscraptest";
        const userPassword = "dantegay";

        const page = await browser.newPage();

        page.setDefaultTimeout(15000);

        await page.goto("https://redzoneserver.com:7777", {
            waitUntil: "domcontentloaded"
        });

        await page.waitForSelector(`#${userLog}`, {
            visible: true
        });

        await page.click(`#${userLog}`);
        await page.type(`#${userLog}`, userValue);

        await page.waitForSelector(`#${passLog}`, {
            visible: true
        });

        await page.click(`#${passLog}`);
        await page.type(`#${passLog}`, userPassword);

        await page.click(`#${loginBtn}`);

        await clickVisibleByText(page, "Tops/Listas");

        await page.waitForSelector(`#${raceIds}`, {
            visible: true,
            timeout: 15000
        });

        await page.click(`#${raceIds}`);

        await page.waitForSelector("table tr", {
            visible: true,
            timeout: 15000
        });

        for (let i = 15; i <= 1005; i += 15) {
            const moreRaces = `[id="race_list ${i}"]`;

            const button = await page.$(moreRaces);

            if (!button) {
                console.log(
                    `No hay más carreras para ampliar. Último bloque: ${i - 15}`
                );

                break;
            }

            console.log(
                `Ampliando la lista en 15 valores, valor actual: ${i}`
            );

            const filasAntes = await page.$$eval(
                "table tr",
                filas => filas.length
            );

            await button.click();

            await page.waitForFunction(
                filasAntes =>
                    document.querySelectorAll("table tr").length >
                    filasAntes,
                {
                    timeout: 5000
                },
                filasAntes
            ).catch(() => {});
        }

        const filas = await page.$$("table tr");

        const resultados = [];

        for (const fila of filas) {
            const botonCarga = await fila.$(
                '[id^="race_list "]'
            );

            if (botonCarga) {
                continue;
            }

            const datosFila = await fila.$$eval(
                "td",
                tds =>
                    tds.map(td =>
                        td.textContent.trim()
                    )
            );

            if (datosFila.length === 0) {
                continue;
            }

            resultados.push(datosFila);

            console.log(datosFila);
        }

        fs.writeFileSync(
            "resultados.txt",
            JSON.stringify(
                resultados,
                null,
                2
            ),
            "utf8"
        );

        console.log(
            `Carreras guardadas: ${resultados.length}`
        );

    } finally {
        await browser.close();
    }
}

async function getDataFromWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 400
    });

    const page = await browser.newPage();

    await page.goto(
        "https://www.example.com",
        {
            waitUntil: "domcontentloaded"
        }
    );

    const result = await page.evaluate(() => {
        return document.querySelector("h1")
            ?.innerText ?? "";
    });

    console.log(result);

    await browser.close();
}

async function handleDynamicWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 200
    });

    const page = await browser.newPage();

    await page.goto(
        "https://quotes.toscrape.com",
        {
            waitUntil: "domcontentloaded"
        }
    );

    const data = await page.evaluate(() => {
        const quotes =
            document.querySelectorAll(".quote");

        return [...quotes].map(quote => {
            const quoteText =
                quote.querySelector(".text").innerText;

            const author =
                quote.querySelector(".author").innerText;

            const tags = [
                ...quote.querySelectorAll(".tag")
            ].map(tag => tag.innerText);

            return {
                quoteText,
                author,
                tags
            };
        });
    });

    console.log(data);

    await browser.close();
}

navigationRedZone();