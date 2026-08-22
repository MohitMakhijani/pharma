const service = require('../services/salePayment.service');


async function addPayment(req,res){

try{

const payment = await service.addPayment({
  storeId:req.user.storeId,
  saleId:req.params.saleId,
  amount:req.body.amount,
  paymentMethod:req.body.paymentMethod,
  referenceNumber:req.body.referenceNumber,
  notes:req.body.notes,
});


res.status(201).json({
 success:true,
 message:'Sale payment recorded successfully',
 data:payment
});


}catch(error){

res.status(400).json({
 success:false,
 message:error.message
});

}

}



async function getPayments(req,res){

try{

const payments = await service.getPayments(
 req.user.storeId,
 req.params.saleId
);


res.json({
 success:true,
 data:payments
});


}catch(error){

res.status(400).json({
 success:false,
 message:error.message
});

}

}



module.exports={
 addPayment,
 getPayments,
};
