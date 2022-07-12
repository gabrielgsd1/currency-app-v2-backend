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

  let createdUser:FrontEndUserData = await prisma.user.create({
      data: dataToSend
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
  let user:User|null =  await prisma.user.findUnique({
      where: {
        email
      }
    })
  if(user == null) return {
    error: true,
    message: 'Wrong Credentials!'
  }
  const isLoginValid = await comparePassword(password, user.password)
  if(isLoginValid){
    return {
      id: user.id,
      name: user.name,
      email: user.email
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
  let createdConversion:Conversion = await prisma.conversion.create({
      data: dataToSend
    })
  return createdConversion
}

async function getConversionsByUserId(id:string)
:Promise<Conversion[]>{
  let conversions:Conversion[] = await prisma.conversion.findMany({
      where: {
        userId: id
      },
      orderBy: {
        date: 'desc'
      }
    })
  return conversions
}

async function getAvailableCurrencies()
:Promise<Currency[]>{
  let currencies:Currency[] = await prisma.currency.findMany()
  return currencies
}

async function deleteConversion(conversionId:string){
  try{
    let deletion:Conversion = await prisma.conversion.delete({
      where: {
        id: conversionId
      }
    })

    let allConversions = await prisma.conversion.findMany({
      where: { 
        userId: deletion.userId
      }
    })

    return allConversions
  } catch(e) {

  }
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
    res.json({  
      error: e
    } )
  }
}) 

app.delete('/deleteConversion', async(req,res) => {
  const {id} = req.body
  const remainingConversions = await deleteConversion(id as string)
  res.json(remainingConversions)
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

app.listen(process.env.PORT || 3001, async () => {
  try{
    await prisma.$connect()
  } catch(e){
    return
  }
})
