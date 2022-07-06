import { PrismaClient, Prisma, Conversion, Currency, User} from "@prisma/client";
import { AxiosInstance } from "axios";
import { Application } from "express";
import * as bcrypt from 'bcrypt'

const express = require('express')
const cors = require('cors')
const app:Application = express()
const axios:AxiosInstance = require('axios').default
const prisma = new PrismaClient()


app.use(express.json())

app.use(cors())

type Login = {
  email: string,
  password: string
}

type FrontEndUserData = {
  id: string,
  name: string,
  email: string
}

type ErrorMessage = {
  error: boolean,
  message: string
}


async function usePrisma(callback:Function){
  await prisma.$connect()

  await callback()

  await prisma.$disconnect()
}

async function hashPassword(password: string)
:Promise<string>{
  const hashedPassword = await bcrypt.hash(password, 1)
  return hashedPassword
}

async function comparePassword(password: string, hashToCheck: string)
:Promise<boolean>{
  const isPasswordValid = await bcrypt.compare(password,hashToCheck)
  return isPasswordValid
}

async function registerUser({name, email, password}: User)
:Promise<FrontEndUserData|ErrorMessage>{
  const hashedPassword = await hashPassword(password)

  const dataToSend:Prisma.UserCreateInput = {
    name,
    email,
    password: hashedPassword,
  }

  let createdUser:FrontEndUserData|null = null

  await usePrisma(async () => {
    const dbUser = await prisma.user.create({
      data: dataToSend
    })
    createdUser = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
    }
  })

  if(createdUser != null){
    return createdUser
  } else {
    return {
      error: true,
      message: 'Error on creating user!'
    }
  }
}

async function checkUser({email, password}:Login)
:Promise<ErrorMessage|FrontEndUserData>{
  let user:User[] = [];
  await usePrisma(async () => {
    user = await prisma.user.findMany({
      where: {
        email
      }
    })
  })

  const isLoginValid = await comparePassword(password, user[0].password)

  if(isLoginValid){
    return {
      id: user[0].id,
      name: user[0].name,
      email: user[0].email
    }
  } else {
    return {
      error: true,
      message: 'Wrong credentials!'  
    }
  }
}

async function createConversion(dataToSend:Prisma.ConversionCreateInput)
:Promise<Conversion|null>{
  let createdConversion:Conversion|null = null;
  await usePrisma(async () => {
    createdConversion = await prisma.conversion.create({
      data: dataToSend
    })
  })
  return createdConversion
}

async function getConversionsByUserId(id:string)
:Promise<Conversion[]>{
  let conversions:Conversion[] = []
  await usePrisma(async () => {
    conversions = await prisma.conversion.findMany({
      where: {
        userId: id
      }
    })
  })
  return conversions
}

async function getAvailableCurrencies()
:Promise<Currency[]>{
  let currencies:Currency[] = []
  await usePrisma(async () => {
    currencies = await prisma.currency.findMany()
  })
  return currencies
}

app.post('/registerUser', async (req,res) => {
  const data:User = req.body
  try{
    const userCreation = await registerUser(data)
    res.json(userCreation)
  } catch(e){
    res.json(e)
  }
  
})

app.post('/getConversions', async (req,res) => {
  const {id} = req.body
  try{
    const conversions = await getConversionsByUserId(id)
    res.json(conversions)
  } catch(e){
    res.json(e)
  }
})

app.get('/getCurrencies', async (req,res) => {
  const currencies = await getAvailableCurrencies()
  res.json(currencies)
})

app.post('/login', async(req,res) => {
  const data:Login = req.body
  
  const result = await checkUser(data)

  res.json(result)
})

app.post('/convert', async (req, res) => {
  const {from, to, id} = req.body
  if(typeof from == null || typeof to == null){
    return res.status(400).json({
      error: true,
      message: "Please select the coins to convert!"
    })
  }
  try{
    const response = await axios.get(`https://api.getgeoapi.com/v2/currency/convert?api_key=${process.env.API_KEY}&from=${from}&to=${to}&amount=1&format=json`)
    const data = response.data
    const toCoinCode = Object.keys(data.rates)[0]
    const conversionObj:Prisma.ConversionCreateInput = {
      from_code: data.base_currency_code,
      rate: Number(data.rates[toCoinCode].rate),
      to_code: toCoinCode,
      user: {
        connect: {
          id
        }
      }
    }
    const createdConversion = await createConversion(conversionObj)
    
    res.json(createdConversion)
  } catch(e){
    res.json(e)
  }
}) 

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

app.listen(process.env.PORT || 3001)
