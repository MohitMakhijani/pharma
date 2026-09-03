const prisma = require('../config/prisma');
const crypto = require('crypto');


async function getCustomers(storeId){

const customers = await prisma.customer.findMany({
where:{
storeId,
isDeleted: false
},
include: {
	ledgerEntries: {
		where: { ledgerType: 'CUSTOMER' },
		select: { amount: true, entryType: true, entryDate: true, createdAt: true },
		orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
	},
},
orderBy:{
createdAt:'desc'
}
});

return customers.map((customer) => ({
	...customer,
	ledgerEntries: undefined,
	outstandingBalance:
		Number(customer.openingBalance || 0) +
		customer.ledgerEntries.reduce((total, entry) => total + Number(entry.amount || 0), 0),
	lastPaymentAmount: (() => {
		const payment = customer.ledgerEntries.find((entry) => entry.entryType === 'SALE_PAYMENT' && Number(entry.amount) < 0);
		return payment ? Math.abs(Number(payment.amount)) : 0;
	})(),
	lastPaymentDate: (() => {
		const payment = customer.ledgerEntries.find((entry) => entry.entryType === 'SALE_PAYMENT' && Number(entry.amount) < 0);
		return payment?.entryDate || null;
	})(),
}));

}



async function getCustomerById(customerId,storeId){

return prisma.customer.findFirst({
where:{
id:customerId,
storeId,
isDeleted: false
}
});

}



async function createCustomer(data,storeId){

const {
name,
phone,
alternatePhone,
email,
gstin,
address,
city,
state,
pincode,
creditLimit,
creditDays,
openingBalance
}=data;


if(!name){
throw new Error('Customer name is required');
}


return prisma.customer.create({

data:{
storeId,
name,
phone:phone || null,
alternatePhone:alternatePhone || null,
email:email || null,
gstin:gstin || null,
address:address || null,
city:city || null,
state:state || null,
pincode:pincode || null,
creditLimit:creditLimit || 0,
creditDays:creditDays || 0,
openingBalance:openingBalance || 0
}

});


}



async function updateCustomer(customerId,storeId,data){

const customer = await prisma.customer.findFirst({
where:{
id:customerId,
storeId,
isDeleted: false
}
});


if(!customer){
throw new Error('Customer not found');
}


return prisma.customer.update({

where:{
id:customerId
},

data

});

}

async function deleteCustomer(customerId, storeId) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId, isDeleted: false },
    select: { id: true },
  });

  if (!customer) return null;

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

async function getCustomerSales(customerId, storeId) {
return prisma.sale.findMany({
where:{customerId,storeId,isDeleted:false},
orderBy:{invoiceDate:'desc'},
include:{items:{include:{product:{select:{name:true}},batch:{select:{batchNumber:true}}}}}
});
}

async function createCustomerLedgerShare(customerId, storeId) {
	const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId, isDeleted: false }, select: { id: true } });
	if (!customer) {
		const error = new Error('Customer not found');
		error.statusCode = 404;
		throw error;
	}
	const share = await prisma.customerLedgerShare.create({
		data: { token: crypto.randomBytes(32).toString('hex'), customerId, storeId },
	});
	return share;
}

async function getPublicCustomerLedger(token) {
	const share = await prisma.customerLedgerShare.findFirst({
		where: { token, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
		select: { customerId: true, storeId: true },
	});
	if (!share) return null;
	const { getCustomerLedger } = require('./customerLedger.service');
	return getCustomerLedger(share.customerId, share.storeId);
}



module.exports={
getCustomers,
getCustomerById,
createCustomer,
updateCustomer,
deleteCustomer,
getCustomerSales
	,createCustomerLedgerShare
	,getPublicCustomerLedger
};
