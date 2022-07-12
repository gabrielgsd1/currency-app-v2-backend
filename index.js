"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios').default;
const prisma = new client_1.PrismaClient();
app.use(express.json());
app.use(cors());
async function hashPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 1);
    return hashedPassword;
}
async function comparePassword(password, hashToCheck) {
    const isPasswordValid = await bcrypt.compare(password, hashToCheck);
    return isPasswordValid;
}
async function registerUser({ name, email, password }) {
    const hashedPassword = await hashPassword(password);
    const dataToSend = {
        name,
        email,
        password: hashedPassword,
    };
    let createdUser = await prisma.user.create({
        data: dataToSend
    });
    if (createdUser != null) {
        return createdUser;
    }
    else {
        return {
            error: true,
            message: 'Error on creating user!'
        };
    }
}
async function checkUser({ email, password }) {
    let user = await prisma.user.findUnique({
        where: {
            email
        }
    });
    if (user == null)
        return {
            error: true,
            message: 'Wrong Credentials!'
        };
    const isLoginValid = await comparePassword(password, user.password);
    if (isLoginValid) {
        return {
            id: user.id,
            name: user.name,
            email: user.email
        };
    }
    else {
        return {
            error: true,
            message: 'Wrong credentials!'
        };
    }
}
async function createConversion(dataToSend) {
    let createdConversion = await prisma.conversion.create({
        data: dataToSend
    });
    return createdConversion;
}
async function getConversionsByUserId(id) {
    let conversions = await prisma.conversion.findMany({
        where: {
            userId: id
        },
        orderBy: {
            date: 'desc'
        }
    });
    return conversions;
}
async function getAvailableCurrencies() {
    let currencies = await prisma.currency.findMany();
    return currencies;
}
async function deleteConversion(conversionId) {
    try {
        let deletion = await prisma.conversion.delete({
            where: {
                id: conversionId
            }
        });
        let allConversions = await prisma.conversion.findMany({
            where: {
                userId: deletion.userId
            }
        });
        return allConversions;
    }
    catch (e) {
    }
}
app.post('/registerUser', async (req, res) => {
    const data = req.body;
    try {
        const userCreation = await registerUser(data);
        res.json(userCreation);
    }
    catch (e) {
        res.json(e);
    }
});
app.post('/getConversions', async (req, res) => {
    const { id } = req.body;
    try {
        const conversions = await getConversionsByUserId(id);
        res.json(conversions);
    }
    catch (e) {
        res.json(e);
    }
});
app.get('/getCurrencies', async (req, res) => {
    const currencies = await getAvailableCurrencies();
    res.json(currencies);
});
app.post('/login', async (req, res) => {
    const data = req.body;
    const result = await checkUser(data);
    res.json(result);
});
app.post('/convert', async (req, res) => {
    console.log('req recebida');
    const { from, to, id } = req.body;
    if (typeof from == null || typeof to == null) {
        return res.status(400).json({
            error: true,
            message: "Please select the coins to convert!"
        });
    }
    try {
        console.log(from, to);
        const response = await axios.get(`https://api.getgeoapi.com/v2/currency/convert?api_key=${process.env.API_KEY}&from=${from}&to=${to}&amount=1&format=json`);
        const data = response.data;
        const toCoinCode = Object.keys(data.rates)[0];
        console.log(data);
        const conversionObj = {
            from_code: data.base_currency_code,
            rate: Number(data.rates[toCoinCode].rate),
            to_code: toCoinCode,
            user: {
                connect: {
                    id
                }
            }
        };
        const createdConversion = await createConversion(conversionObj);
        res.json(createdConversion);
    }
    catch (e) {
        res.json({
            error: e
        });
    }
});
app.delete('/deleteConversion', async (req, res) => {
    const { id } = req.body;
    const remainingConversions = await deleteConversion(id);
    res.json(remainingConversions);
});
/// Get all the available coins in the API 
// type Coin = {
//   code: string,
//   currency: string
// }
// app.post('/insertCoins', async (req,res) => {
//   const data = await axios.get(`https://api.getgeoapi.com/v2/currency/list?api_key=${process.env.API_KEY}&format=json`)
//   const coins:Coin = data.data.currencies
//   const coinsArr:Array<Coin> = []
//   for(let coin of Object.entries(coins)){
//     coinsArr.push({
//       code: coin[0],
//       currency: coin[1]
//     })
//   }
//   const sorted = coinsArr.sort((a,b) => {
//     return a.code.charCodeAt(0) - b.code.charCodeAt(0)
//   })
//   await usePrisma(async () => {
//     await prisma.currency.deleteMany({})
//     await prisma.currency.createMany({
//       data: sorted
//     })
//   })
//   res.json(sorted)
//   let resp;
//   await usePrisma(async () => {
//     const coins = await prisma.currency.findMany({})
//     resp = coins
//   })
//   res.json(resp)
// })
app.listen(process.env.PORT || 3001, async () => {
    try {
        await prisma.$connect();
    }
    catch (e) {
        return;
    }
});
