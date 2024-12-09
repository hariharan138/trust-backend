let Trust=require('../models/Trust.model')
const {validateTrust} = require('../Validation/ValidationUser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const UserModel = require('../models/User.model')
const TrustModel = require('../models/Trust.model')
const FoodModel = require('../models/Food.model')
const cloudinary = require('../CloudinaryConfig.js/cluoudinaryconfig')

const fs = require('fs')
const { log } = require('console')


let addTrusts=async(req,res)=>{
    try{
        await validateTrust(req)
        let {firstName,email, lastName, phone, password, confirmPassword,trustName,
             trustId, address, trustEmail,trustPhoneNumber}=req.body
             
        //     if (!req.file || !req.file.path) {
        //         return res.status(400).json({ error: true, message: "Image upload failed. Please try again." });
        //     }
        //     console.log(req.file.path)
        //     //  console.log(req.files)  //09845723765-uploads/scrrenshot(10).png
        // // in the place of image it should get the image's path , if the client is passing 
        // // the image and not path, then here instead of image put image.path
        // // if we are not using clusters we shoudl use upload or if we use cluster then we should upload_stream 
       
        // let result = await cloudinary.uploader.upload(req.file.path, {
        //     folder: "TrustProfile",
        //     // resource_type: "image",
        //     // size: 300,
        //     // crop: "scale"
        // })

        // fs.unlink(req.file.path, (err) => {
        //     if (err) {
        //         console.error("Error deleting file:", err);
        //     }
        // });

        let currentPassword = await bcrypt.hash(password,10)

    // for cluster based
        let imageData = {}; 
    
    if (req.file && req.file.buffer) {
      // Upload image to Cloudinary if it's uploaded
    //   const result = await cloudinary.uploader.upload_stream(
    //     { folder: 'TrustProfile' }, // Upload to Cloudinary's TrustProfile folder
    //     (error, result) => {
    //       if (error) {
    //         // console.log("availabel")
    //         console.log(error);
    //         return res.status(500).json({ error: true, message: error.message });
    //       } else {
    //         // console.log("result is not ddefiensdfnlsjfnln")
    //         imageData = {
    //           public_id: result.public_id,
    //           url: result.secure_url,
    //         };
    //       }
    //     }
    //   );

      // Pipe the file buffer to Cloudinary
    //   const stream = cloudinary.uploader.upload_stream({ folder: 'TrustProfile' });
    //   stream.end(req.file.buffer); // Pass the file buffer to Cloudinary

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "TrustProfile" }, // Upload to Cloudinary's TrustProfile folder
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        // Pipe the file buffer to Cloudinary
        stream.end(req.file.buffer);
      });

      const result = await uploadPromise;
      imageData = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }
    

        // console.log(currentPassword)

        let newTrust = await Trust.create({
            firstName,
            lastName,
            email,
            phone,
            // image: {
            //     public_id:  result.public_id,
            //     url: result.secure_url
            // },
            // for cluster based
            image: imageData,
            password: currentPassword,
            confirmPassword: currentPassword,
            trustName,
             trustId,
             address,
             trustEmail,
            trustPhoneNumber }) 

        // let newTrust = new TrustModel({firstName,lastName,email,phone, password: currentPassword, confirmPassword: currentPassword,trustName, trustId, address, trustEmail,trustPhoneNumber })
        // await newTrust.save()
        res.status(201).json({error:false,message:"Trust Added Successfully",data:newTrust})
    }
    catch(err){
        res.status(500).json({error:true,message: err.message})
    }
}

let loginTrusts = async (req, res)=>{
    try{
            let {trustEmail, password} = req.body
            const {authToken} = req.cookies
            if(authToken){
                const decodedData = jwt.verify(authToken, process.env.JWT_SECREAT_KEY)
                if(decodedData){
                    throw new Error("user is already logged in")
                }
            }
            let isExist = await Trust.findOne({trustEmail: trustEmail})
            
            if(!isExist){
                throw new Error("Trust is not registered")
            }

            let isMatching = await bcrypt.compare(password, isExist.password)
            if(!isMatching){
                throw new Error("incorrect password")
            }

            let token = await jwt.sign({_id: isExist._id,  role: 'trust'}, process.env.JWT_SECREAT_KEY ,{expiresIn: process.env.JWT_TOKEN_EXPIRY})
        
            res.cookie("authToken", token, {expires: new Date(Date.now() + 20 * 500000)}) //in 40min cookie will expire
            res.status(200).json({msg: isExist.firstName + " login Successfull", token: token, success: true })
    }
    catch(err){
        res.status(500).json({error:true,message:err.message})
    }
}

let logoutTrusts = async (req, res)=>{
         res.cookie("authToken", null, {expires: new Date(Date.now())})
         res.status(200).json({msg: "user logged out successfully"})       
}

let getUsers = async (req,res)=>{
let allowedFields = ["Name", "phone", "email", "address", "_id", "image"]

        try{
            // let user = req.user
            
            // console.log(req.params)
            let limit = (req.params.limit > 20 ? 10 : req.params.limit) || 10
            let page = req.params.page || 1
            let skip = (page-1) * limit

            let data = await UserModel.find({}).skip(skip).limit(limit).select(allowedFields)
            res.status(200).json({msg: "Users data fetched", page, limit, data})
            // res.status(200).json({msg: "Users data fetched"})
        }
        catch(err){
        res.status(500).json({error:true,message:err.message})
        }
}

let getRegisteredFoods = async (req, res)=>{
    try{
        let user = req.user

        let page = req.query.page || 1
        let limit = (req.query.limit > 20 ? 10 : req.query.limit) || 10
        let skip = (page-1) * limit
       
        let preferredOrders = await FoodModel.find({preferred: {$in: [user._id]}, acceptedBy: {$eq: null}}).skip(skip).limit(limit).select("fromUserId noOfPeople address veg createdAt preferred senderName senderPhoneNumber acceptedBy acceptedTrustName acceptedTrustPhoneNumber")
        let preferredOrdersSenderId = preferredOrders?.map(order=>{
        return order._id.toString()
        })
        
        
          let normalOrders = await FoodModel.find({_id: {$nin : preferredOrdersSenderId}, acceptedBy: {$eq: null}}).skip(skip).limit(limit)

         let data = preferredOrders.concat(normalOrders)
         
        res.status(200).json({msg: "data fetched correctly", data}) 
    }
    catch(err){
        res.status(500).json({error:true,message:err.message})
    }
}

let acceptFoodOrder = async (req, res)=>{
    try{
        let user = req.user
        let {orderId} = req.params
        let isAvailable = await FoodModel.findById(orderId)
        if(!isAvailable){
            throw new Error("order not found")
        }
        
        if(isAvailable?.acceptedBy){
            throw new Error("already accepted")
        }
        
        isAvailable.acceptedBy = user._id
        isAvailable.acceptedTrustName = user.trustName
        isAvailable.acceptedTrustPhoneNumber = user.trustPhoneNumber
        await isAvailable.save()
        res.status(200).json({msg: user.firstName + " accepted the order", data: isAvailable})

    }
    catch(err){
        res.status(500).json({error:true,message:err.message})
    }
}

let searchUser = async (req, res)=>{
    try{
        let allowedFields = ["Name", "phone", "email", "address", "image", "role"]
        let search = req.query.search

        let limit = req.query.limit > 20 ? 20 : req.query.limit || 10
        let page = req.query.page || 1
        let skip = (page -1)* limit

        let totalDocuments = await UserModel.countDocuments();

        let totalPages = Math.ceil(totalDocuments / limit);

        if (page > totalPages) {
            throw new Error(`Not enough data available. Total pages: ${totalPages}`);
        }
        const regex = new RegExp(search, "i"); // 'i' makes it case-insensitive

        const data = await UserModel.find({ Name: { $regex: regex } }).skip(skip).limit(limit).select(allowedFields)
        
       if(!data.length>0){
        throw new Error("No Users Available")
       }
        res.status(200).json({msg: "Users fetched successfully", data})
    }
    catch(err){
        res.status(500).json({error:true,message:err.message})
    }
}

let getTrustProfile =  (req, res)=>{
    try{
        let user = req.user
        let encodedUserData = {}
        let allowedField = ["image", "_id", "firstName", "lastName", "email", "phone", "trustName", "address", "trustPhoneNumber", "createdAt", "updatedAt"]

        for(let keys of allowedField){
            encodedUserData[keys] = user[keys]
        }

        res.status(200).json({msg: "Users fetched successfully", user: encodedUserData})

    }
    catch(err){
        res.status(500).json({error:true,message:err.message})
    }
}

let getTrustTransactions = async (req, res)=>{
try{
    let user = req.user
    let search = req.query.search

    let limit = req.query.limit > 20 ? 20 : req.query.limit || 10
    let page = req.query.page || 1
    let skip = (page -1)* limit


    const regex = new RegExp(search, "i"); // 'i' makes it case-insensitive

    let totalNoOfDocumentsAvailable = await FoodModel.find({$and: [{acceptedBy: user._id},{senderName: {$regex: regex}}]})

    let totalPages = Math.ceil(totalNoOfDocumentsAvailable.length / limit);

    if (page > totalPages) {
        throw new Error(`Not enough data available. Total pages: ${totalPages}`);
    }


    let data = await FoodModel.find({$and: [{acceptedBy: user._id},{senderName: {$regex: regex}}]}).select("acceptedBy acceptedTrustName senderName senderPhoneNumber veg noOfPeople").skip(skip).limit(limit)
    res.status(200).json({msg: "Users fetched successfully", data})
}
catch(err){
    res.status(500).json({error:true,message:err.message})
}
}


module.exports={
    addTrusts,
    loginTrusts,
    logoutTrusts,
    getUsers,
    getRegisteredFoods,
    acceptFoodOrder,
    searchUser,
    getTrustProfile,
    getTrustTransactions
}