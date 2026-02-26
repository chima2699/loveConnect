const paystack = require("../utils/paystack");

async function createRecipient(user, bank) {
  const res = await paystack.post("/transferrecipient", {
    type: "nuban",
    name: bank.accountName,
    account_number: bank.accountNumber,
    bank_code: bank.bankCode,
    currency: "NGN"
  });

  return res.data.data.recipient_code;
}
