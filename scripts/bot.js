const axios = require('axios');
const http = require('http');
const hostname = '127.0.0.1';
const port = 3000;

const Web3 = require('web3');
const web3 = new Web3('https://mainnet.infura.io/v3/f325e2920b0a4e239d6b867d23d0aaaa');

//Compound
const comptrollerABI = require('../abis/comptroller.json');
const comptrollerContractAddr = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
const comptrollerContract = new web3.eth.Contract(comptrollerABI, comptrollerContractAddr);
const cErc20ABI = require('../abis/cERC20.json');
const compoundURL = 'https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2' ;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  main();
});

const queryBorrowedAccounts = async (symbol, accrualBlockNumber) => {
    let accountCTokens;
    try {
        const result = await axios.post(
            compoundURL,
            {
                query: `
                    {
                        accountCTokens(
                            first: 1000
                            orderBy: accrualBlockNumber
                            where: {
                                accrualBlockNumber_gt: ${accrualBlockNumber}
                                storedBorrowBalance_gt: 0
                                symbol: "${symbol}"
                            }
                        ) {
                            id
                            symbol
                            accrualBlockNumber
                            storedBorrowBalance
                            cTokenBalance
                            market {
                                id
                                underlyingAddress
                                underlyingSymbol
                            }
                            account {
                                id
                                tokens {
                                    market {
                                        id
                                        symbol
                                    }
                                }
                                health
                                totalBorrowValueInEth
                                totalCollateralValueInEth
                            }
                        }
                    }
                `
            }
        );
        accountCTokens = result.data.data.accountCTokens;
        lastBlockNumber = accountCTokens[accountCTokens.length - 1].accrualBlockNumber;
        // console.log (`Query ${symbol} result: ${accountCTokens.length}, last block number: ${lastBlockNumber}`);
        
        for(idx in accountCTokens) {
            borrowedAccount.add(accountCTokens[idx].account);
        } 

        if (accountCTokens.length == 1000) {
            await queryBorrowedAccounts(symbol, lastBlockNumber);
        }
    } catch (err) {
        console.log(err);
    }
}

const queryAllMarkets = async () => {
    try {
        const result = await axios.post(
            compoundURL,
            {
                query: `
                {
                    markets {
                      borrowRate
                      cash
                      collateralFactor
                      exchangeRate
                      interestRateModelAddress
                      name
                      reserves
                      supplyRate
                      symbol
                      id
                      totalBorrows
                      totalSupply
                      underlyingAddress
                      underlyingName
                      underlyingPrice
                      underlyingSymbol
                      reserveFactor
                      underlyingPriceUSD
                    }
                  }
                `
            }
        );
        return result.data.data.markets;
    } catch (err) {
        console.log(err);
    }
}

const getAccountLiquidity = async(address) => {
    return await comptrollerContract.methods.getAccountLiquidity(address).call()
}

const borrowedAccount = new Set();
const cTokensContracts = [];
const setUpMarkets = async() => {
    markets = await queryAllMarkets();
    markets.forEach(market => cTokensContracts[market.symbol] = new web3.eth.Contract(cErc20ABI, market.id));
}

const queryAllBorrowedAccount = async() => {
    let i = 0;
    for (id in markets) {
        let lastBlockNumber = 0;
        console.log(`Querying market ${markets[id].symbol}`);
        await queryBorrowedAccounts(markets[id].symbol, lastBlockNumber);
        if (i++ == 2) return
    }
}

const liquidateBorrow = async(borrower) => {
    const cTokenBalance = [];
    for (idx in borrower.tokens) {
        market = borrower.tokens[idx].market;
        balance = await cTokensContracts[market.symbol].methods.balanceOf(borrower.id).call();
        cTokenBalance[idx] = {'symbol': market.symbol, 'balance': balance};
    }

    cTokenBalance.sort((a, b) => b.balance - a.balance)
    accountLiquidity = await getAccountLiquidity(borrower.id)
    try {
        if (cTokenBalance[0].balance > 0 && accountLiquidity[2] > 0)
            console.log(`liquidate borrower ${borrower.id} with shortfall ${accountLiquidity[2]} and take ${cTokenBalance[0].symbol} as collateral`);
    } catch (err) {
        console.log(err);
    }
}

const main = async() => {
    await setUpMarkets();
    await queryAllBorrowedAccount();
    
    var accountInterval = setInterval(async () => {
        borrowedAccount.forEach(async (account) => {
            setTimeout(async () => {
                accountLiquidity = await getAccountLiquidity(account.id)
                
                if (accountLiquidity[2] > 0) {
                    await liquidateBorrow(account, accountLiquidity[2])
                }
              }, 30000);
        });
    }, 5000);
}