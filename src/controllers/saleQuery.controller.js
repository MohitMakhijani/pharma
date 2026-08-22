const saleQueryService = require('../services/saleQuery.service');


async function getSales(req,res){

  try {

    const sales = await saleQueryService.getSales(
      req.user.storeId
    );

    res.json({
      success:true,
      data:sales
    });


  } catch(error){

    console.error(error);

    res.status(400).json({
      success:false,
      message:error.message
    });

  }

}



async function getSaleById(req,res){

  try {

    const sale = await saleQueryService.getSaleById(
      req.params.id,
      req.user.storeId
    );


    if(!sale){
      return res.status(404).json({
        success:false,
        message:"Sale not found"
      });
    }


    res.json({
      success:true,
      data:sale
    });


  } catch(error){

    console.error(error);

    res.status(400).json({
      success:false,
      message:error.message
    });

  }

}


module.exports={
  getSales,
  getSaleById
};
