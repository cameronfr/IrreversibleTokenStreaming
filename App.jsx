require('babel-polyfill')
var React = require("react")
var ReactDOM = require("react-dom")
import {useState} from 'react'
const CopyToClipboard = require('clipboard-copy')
import {Client as Styletron} from 'styletron-engine-atomic';
import {Provider as StyletronProvider} from 'styletron-react';
import {useStyletron} from 'baseui';
import {LightTheme, BaseProvider, styled} from 'baseui';
import {Input} from 'baseui/input';
import { FormControl } from "baseui/form-control";
import { Select, TYPE as SelectTypes } from "baseui/select";
import { Notification, KIND as NotifcationKind } from "baseui/notification";
import {
  Label1,
  Label2,
  Label3,
  Label4,
  Paragraph1,
  Paragraph2,
  Paragraph3,
  Paragraph4,
  Paragraph5,
  Display1,
  Display2,
  Display3,
  Display4,
  H1, H2, H3, H4, H5, H6,
} from 'baseui/typography';
import {
  Card,
  StyledBody,
  StyledAction
} from "baseui/card";
import {
  ProgressSteps,
  Step,
  NumberedStep
} from "baseui/progress-steps";
import { StatefulTooltip } from "baseui/tooltip";
import {Spinner} from 'baseui/spinner';
import { Button } from "baseui/button";
import ArrowRight from 'baseui/icon/arrow-right';
import {Datepicker, formatDate} from 'baseui/datepicker';
import {TimePicker} from 'baseui/timepicker';

var Web3 = require("web3");
const BN = require('bn.js');
const BigNumber = require('bignumber.js'); //supports decimals; use for input.
const tokenMap = require('eth-contract-metadata')

// Ropsten test network. TST test tokens.
const USE_TESTNET = (new  URLSearchParams(window.location.search)).get("test") == "true"
const OBSFUCATION_KEY = "obsfucation"

//wait for page load before instantiationg
var web3
var toBN

const tokenListMainnet = Object.keys(tokenMap).map(k =>
  ({address: k, ...tokenMap[k], tags: (tokenMap[k].name + tokenMap[k].symbol)}))
const tokenListTestnet = [{address: "0x722dd3F80BAC40c951b51BdD28Dd19d435762180", name: "Test Token", symbol: "TST", decimals: 18}]
const tokenList = USE_TESTNET ? tokenListTestnet : tokenListMainnet

const SABLIER_MAINNET_ADDRESS = "0xA4fc358455Febe425536fd1878bE67FfDBDEC59a"
const SABLIER_TESTNET_ADDRESS = "0xc04Ad234E01327b24a831e3718DBFcbE245904CC"
const SABLIER_CONTRACT_ADDRESS = USE_TESTNET ? SABLIER_TESTNET_ADDRESS : SABLIER_MAINNET_ADDRESS

const ERC20_MAINNET_ADDRESS = "0x6b175474e89094c44da98b954eedeac495271d0f"
const ERC20_TESTNET_ADDRESS = "0x722dd3F80BAC40c951b51BdD28Dd19d435762180"
const ERC20_CONTRACT_ADDRESS = USE_TESTNET ? ERC20_TESTNET_ADDRESS : ERC20_MAINNET_ADDRESS

// hashes for mainnet contract ABIs
const SABLIER_ABI_SHA3 = "0xcbfc9f3ace1802ac45478ea2849968b5f2a6895f1c4beea8e29085ec84a2fe43"
const ERC20_ABI_SHA3 = "0xa533db48442c1c18882149f8a3b768b48288edf57aecf5122aa8b9170d52dcb2"


var getABI = async (CONTRACT_ADDRESS, HASH) => {
	const API_URL = "https://api.etherscan.io/api?module=contract&action=getabi&address="
  var json = await fetch(API_URL+CONTRACT_ADDRESS).then(r => r.json()).then(r => JSON.parse(r.result))
  if (web3.utils.sha3(json) != HASH) {
    throw "ABI hash does not match!"
  }
  return json
}


class App extends React.Component {

	sablierABI = null
	erc20ABI = null
	metamaskAddress = null
	Centered = styled('div', {
	  display: 'flex',
	  justifyContent: 'center',
	  alignItems: 'center',
	});

	constructor(props) {
		super(props)

		this.state = {
      tokenList: [...tokenList],
			finishedInitialLoad: false,
			isLoading: false,
			processStatusState: 0, //See ProgressSteps in render function
			controllerAccount: null,
      payeeAddress: "",
      dateRange: ["", ""],
      selectedToken: null,
      tokenBalances: {}, // key: address, value: BN.js num
      finishedLoadingTokenBalances: false,
      depositAmountUnconverted: "",
      errorNotification: "",
      successNotification: "",
      streamID: "",
      transactionHash: "",
		}
	}

	async componentDidMount() {
    await new Promise(resolve => {
      window.onload = () => resolve()
    })

    window.ethereum.setMaxListeners(1000) // so can make many balance calls at once
    web3 = new Web3(window.ethereum)
    toBN = web3.utils.toBN
		this.metamaskAddress = (await window.ethereum.enable())[0];

    [this.sablierABI, this.erc20ABI] = await Promise.all([
			getABI(SABLIER_MAINNET_ADDRESS, SABLIER_ABI_SHA3),
			getABI(ERC20_MAINNET_ADDRESS, ERC20_ABI_SHA3),
		])

    var getTokenBalances = tokenList.map(async (item) => {
  	  var ERC20Contract = new web3.eth.Contract(this.erc20ABI, item.address);
      try {
        var balance = toBN(await ERC20Contract.methods.balanceOf(this.metamaskAddress).call())
        this.setState(prevState => ({tokenBalances: {...prevState.tokenBalances, [item.address]:balance}}))
      }
      catch {
        console.log("Error loading balance for " + item.name + " ( " + item.address + " ) ")
      }
    })
    Promise.all(getTokenBalances).then(() => {
      this.setState({finishedLoadingTokenBalances: true})
      var sortedTokenList = [...tokenList].sort((a, b) => {
        if (!(a.address in this.state.tokenBalances)) {
          return 1
        } else if (!(b.address in this.state.tokenBalances)) {
          return -1
        } else {
          var aIsGreater = this.state.tokenBalances[a.address].gt(this.state.tokenBalances[b.address])
          return aIsGreater ? -1 : 1
        }
      })
      this.setState({tokenList: sortedTokenList})
    })

		this.setState({finishedInitialLoad: true})
    this.loadSavedState()
	}

  async loadSavedState() {
    var savedPrivateKey = JSON.parse(window.localStorage.getItem("savedKey", null))

    if (savedPrivateKey != null) {
      var account = web3.eth.accounts.decrypt(savedPrivateKey, OBSFUCATION_KEY)
      var canDelete = await this.canDeletePrivateKey(account)
      if (canDelete.can) {
        this.setState({controllerAccount: account, processStatusState: 5})
      }
    }
    else {
      var account = web3.eth.accounts.create(web3.utils.randomHex(32))
    }
    this.setState({controllerAccount: account})
		web3.eth.accounts.wallet.add(account) // so we can send using this account easily.
  }

  // Display form is e.g. 0.7DAI. Returns real-form BN.js num
  convertDisplayTokenAmount = (amount, selectedToken) => {
    var tokenMultiplier = BigNumber(10).pow(BigNumber(selectedToken.decimals))
    var convertedAmount = toBN(tokenMultiplier.multipliedBy(BigNumber(amount)))
    return convertedAmount
  }

  // Real form is e.g. 0.7*(10**18) DAI -- i.e. no decimals. Returns display-form BigNumber.js num
  convertRealTokenAmount = (amount, selectedToken) => {
    var tokenMultiplier = BigNumber(10).pow(BigNumber(selectedToken.decimals))
    var convertedAmount = BigNumber(amount.toString()).dividedBy(tokenMultiplier)
    return convertedAmount
  }

	render() {
    var [payeeAddressValid, payeeAddressError] = (() => {
      if(!this.state.finishedInitialLoad || !this.state.controllerAccount) {
        return [false, null]
      }
      else if(!web3.utils.isAddress(this.state.payeeAddress)) {
        return [false, "Invalid ethereum address"]
      }
      else if(this.state.payeeAddress.toLowerCase() == this.metamaskAddress.toLowerCase()) {
        return [false, "The payee address cannot match your funding address"]
      }
      else if (this.state.payeeAddress.toLowerCase() == this.state.controllerAccount.address.toLowerCase()) {
        return [false, "Don't stream to the temporary controller address!"]
      }
      else if((new BN(this.state.payeeAddress.slice(2))).eq(new BN(0))) {
        return [false, "Cannot be the zero address!"]
      }
      else return [true, null]
    })()

    var [dateRangeValid, dateRangeError] = (() => {
      const dates = this.state.dateRange
      if (!dates[0] || !dates[1]) {
        return [false, null]
      }
      if (dates[0] > dates[1]) return [false, "The start must be before the end"]
      if (dates[0] < new Date(Date.now() + (600*1000))) return [false, "The start must be at least ten minutes from now"]
      else return [true, null]
    })()

    var [depositAmountValid, depositAmountError] = (() => {
      if(!this.state.finishedInitialLoad || !this.state.selectedToken
        || !this.state.depositAmountUnconverted || !this.state.finishedLoadingTokenBalances) {
        return [false, null]
      }
      var tokenBalance = this.state.tokenBalances[this.state.selectedToken.address]
      try {
        var depositAmountConverted = this.convertDisplayTokenAmount(this.state.depositAmountUnconverted, this.state.selectedToken)
      } catch {
        return [false, "Not a number"]
      }
      if (depositAmountConverted.lte(toBN(0))) {
        return [false, "Amount must be greater than 0"]
      }
      else if (depositAmountConverted.gt(tokenBalance)) {
        var balanceDisplay = this.convertRealTokenAmount(tokenBalance, this.state.selectedToken)
        return [false, "You only have " + balanceDisplay.toString() + " " +  this.state.selectedToken.symbol]
      }
      else return [true, null]
    })()

    const getTokenSelectorLabel = ({option}) => {
      var tokenBalance = 0
      if (option.address in this.state.tokenBalances) {
        // Losing precision but okay, just for display
        tokenBalance = this.convertRealTokenAmount(this.state.tokenBalances[option.address], option).decimalPlaces(2)
      }
      return (
        <div style={{display: "flex", justifyContent: "space-between"}}>
          <div>
            {option.name}
          </div>
          <div style={{display: "flex"}}>
            {option.symbol }
            <div style={{display: "flex", alignItems:"center", marginLeft: THEME.sizing.scale300, marginRight: THEME.sizing.scale300}}>
              {option.logo && <img src={"/tokenIcons/"+option.logo} style={{width: THEME.sizing.scale650, height:THEME.sizing.scale650}}/>}
            </div>
            {tokenBalance.toFixed(2)}
          </div>
        </div>
      );
    };

    var readyToContinue = payeeAddressValid && dateRangeValid && depositAmountValid && this.state.finishedInitialLoad && this.metamaskAddress && this.state.controllerAccount
    var allFieldsDisabled = this.state.processStatusState != 0

    // On delete private key, check to see that it has no ERC20 tokens.
		return (
      <this.Centered>
        <div style={{display: "flex", flexDirection: "column", maxWidth:"900px", margin: "30px", marginTop: "0px"}}>
          <H1 style={{marginTop: "20px", marginBottom: "0px"}}>Irreversible Token Streaming</H1>
          <Paragraph1 >{"Create a stream, fund it, and throw away the key."}</Paragraph1>

          <FormControl
            label={() => "Payee Address"}
            error={this.state.payeeAddress ? payeeAddressError : undefined}
            caption={"Enter the address that will receive the stream of tokens"}
            >
      			<Input
      				value={this.state.payeeAddress}
      				onChange={e => this.setState({payeeAddress: e.target.value})}
      				error={this.state.payeeAddress && !payeeAddressValid}
      				positive={this.state.payeeAddress && payeeAddressValid}
              disabled={allFieldsDisabled}
      			/>
          </FormControl>
          <div style={{display: 'flex', alignItems: 'center', flexWrap: "wrap"}}>
            <div style={{marginRight:THEME.sizing.scale300, minWidth:"250px", flexGrow: 1}}>
              <FormControl label={"Token"} caption={"Select the token to use for funding"}>
                <Select
                  options={this.state.tokenList}
                  value={this.state.selectedToken ? [this.state.selectedToken] : null}
                  maxDropdownHeight={"300px"}
                  valueKey={"tags"}
                  type={SelectTypes.search}
                  placeholder="Select token"
                  isLoading={!this.state.finishedLoadingTokenBalances}
                  getOptionLabel={getTokenSelectorLabel}
                  getValueLabel={({option}) => option.name}
                  onChange={params => params.value && this.setState({selectedToken:params.value[0]})}
                  disabled={allFieldsDisabled}
                />
              </FormControl>
            </div>
            <div style={{marginRight:THEME.sizing.scale300, minWidth:"250px", flexGrow: 1}}>
              <FormControl
                label={"Amount"}
                caption={"This is the amount that will be disbursed in total"}
                error={depositAmountError}>
                <Input
                  value={this.state.depositAmountUnconverted}
                  endEnhancer={this.state.selectedToken ? this.state.selectedToken.symbol : undefined}
                  onChange={e => {this.setState({depositAmountUnconverted: e.target.value})}}
                  error={this.state.depositAmountUnconverted && this.state.selectedToken && !depositAmountValid}
                  disabled={allFieldsDisabled}
                  >
                </Input>
              </FormControl>
            </div>
          </div>
          <FormControl
            caption={"Enter the stream start and end time. You can manually type values."}
            error={this.state.dateRange[0] ? dateRangeError : undefined}
            overrides={{Caption: {style: ({$theme}) => ({marginTop: "-7px"})}}}
            >
            <DateRangePicker
              dates={this.state.dateRange}
              setDates={dates => this.setState({dateRange: dates})}
              error={this.state.dateRange[0] && this.state.dateRange[1] && !dateRangeValid}
              disabled={allFieldsDisabled}/>
          </FormControl>
          <div style={{display: "flex", flexDirection: "row", flexWrap: "wrap"}}>
            <div style={{flexBasis: "250px", marginRight:"20px", flexGrow: 1}}>
              {this.state.errorNotification &&
                <Notification kind={NotifcationKind.negative} closeable autoHideDuration={0}>
                  {this.state.errorNotification}
                </Notification>
              }
              {this.state.successNotification &&
                <Notification kind={NotifcationKind.positive} closeable autoHideDuration={0}>
                  {this.state.successNotification}
                </Notification>
              }
              <ProgressSteps current={this.state.processStatusState}>
                <NumberedStep title="Process Start">
                  <Paragraph2>
                    {"Click to start the process. You'll have to approve two transactions"}
                  </Paragraph2>
                  <Button size="compact"
                    onClick={() => this.beginProcess()}
                    disabled={!readyToContinue}>
                    Start
                  </Button>
                </NumberedStep>
                <NumberedStep title="Gas Transfer">
                  <Paragraph2>
                    Transferring gas to the controlling account. Please approve the transaction.
                  </Paragraph2>
                  <Spinner size={24}/>
                </NumberedStep>
                <NumberedStep title="Sablier Contract Approval">
                  <Paragraph2>
                    Approving the contract to spend tokens. No action is required.
                  </Paragraph2>
                  <Spinner size={24}/>
                </NumberedStep>
                <NumberedStep title="Token Transfer">
                  <Paragraph2>
                    Transferring tokens to the controlling account. Please approve the transaction.
                  </Paragraph2>
                  <Spinner size={24}/>
                </NumberedStep>
                <NumberedStep title="Stream Creation">
                  <Paragraph2>
                    Calling the Sablier contract to create the stream. No action is required.
                  </Paragraph2>
                  <Spinner size={24}/>
                </NumberedStep>
                <NumberedStep title="Private Key Deletion">
                  <Paragraph2>
                    The stream has been created. See the transaction ID and stream ID in the card.
                  </Paragraph2>
                  <Button size="compact"
                    onClick={() => this.attemptDeletePrivateKey()}>
                    {"Delete private key"}
                  </Button>
                </NumberedStep>
              </ProgressSteps>
            </div>
            <div style={{flexBasis: "250px", flexGrow: 1}}>
              <Card>
                <StyledBody>
                  <Label2>Controller Address</Label2>
                  <StatefulTooltip content={() => <div>click to copy </div>}>
                    <Paragraph2
                      onClick={() => CopyToClipboard(this.state.controllerAccount ? this.state.controllerAccount.address : "Pending")}
                      style={{cursor:"grab", display: "inline-block"}}>
                      {this.state.controllerAccount ? this.state.controllerAccount.address : "Pending"}
                    </Paragraph2>
                  </StatefulTooltip>
                  <Paragraph2 style={{marginTop: 0}}>
                    This is the address of the temporary account that will be creating the Sablier stream.
                  </Paragraph2>
                  <Label2>Transaction Hash</Label2>
                  <StatefulTooltip content={() => <div>Click to Copy 📋</div>}>
                    <Paragraph2
                      onClick={() => CopyToClipboard(this.state.transactionHash || "Pending")}
                      style={{cursor:"grab", display: "inline-block"}}>
                      {this.state.transactionHash || "Pending"}
                    </Paragraph2>
                  </StatefulTooltip>
                  <Paragraph2 style={{marginTop: 0}}>
                    The transaction hash of the stream creation contract call.
                  </Paragraph2>
                  <Label2>Stream ID</Label2>
                  <StatefulTooltip content={() => <div>Click to Copy 📋</div>}>
                    <Paragraph2
                      onClick={() => CopyToClipboard(this.state.streamID || "Pending")}
                      style={{cursor:"grab", display: "inline-block"}}>
                      {this.state.streamID || "Pending"}
                    </Paragraph2>
                  </StatefulTooltip>
                  <Paragraph2 style={{marginTop: 0}}>
                    The stream ID of the Sablier stream, used by the payee when withdrawing funds.
                  </Paragraph2>
                </StyledBody>
              </Card>
            </div>
          </div>
        </div>
      </this.Centered>
		)
	}

  async beginProcess() {
    // Save the private key to localStorage temporarily, in case anything happens
    // Only save if it's not already in the localStorage.
    var savedPrivateKey = JSON.parse(window.localStorage.getItem("savedKey", null))
    if (!savedPrivateKey) {
      var obsfucatedAccount = web3.eth.accounts.encrypt(this.state.controllerAccount.privateKey, OBSFUCATION_KEY)
      window.localStorage.setItem("savedKey", JSON.stringify(obsfucatedAccount))
    }

    this.setState({processStatusState:1})
    var desiredAmount = this.convertDisplayTokenAmount(this.state.depositAmountUnconverted, this.state.selectedToken)
    var startTimeSec = toBN(Math.ceil(this.state.dateRange[0].getTime() / 1000))
    var endTimeSec = toBN(Math.ceil(this.state.dateRange[1].getTime() / 1000))
    var timeDelta = endTimeSec.sub(startTimeSec)
    if (desiredAmount.lt(timeDelta)) {
      var minAmountNeeded = this.convertRealTokenAmount(timeDelta, this.state.selectedToken)
      this.setState({errorNotification:"Desired amount too small, must be at least " + minAmountNeeded.toString() + " " + this.state.selectedToken.symbol})
      this.setState({processStatusState:0}) // might be better to have user click before returning to start state
    }
    var actualAmount = desiredAmount.sub(desiredAmount.mod(timeDelta))
    var {streamID, transactionHash} = await this.createPayroll(this.metamaskAddress, this.state.controllerAccount, this.state.payeeAddress, actualAmount, startTimeSec, endTimeSec)

    this.setState({streamID, transactionHash})
    var savedPreviousTransactions = JSON.parse(window.localStorage.getItem("savedTXs")) || []
    savedPreviousTransactions.push({streamID, transactionHash})
    console.log(savedPreviousTransactions)
    window.localStorage.setItem("savedTXs", JSON.stringify(savedPreviousTransactions))
  }

	async createPayroll (sendingAddress, controllerAccount, payeeAddress, amount, startTime, endTime) {
	  var ERC20Contract = new web3.eth.Contract(this.erc20ABI, ERC20_CONTRACT_ADDRESS);
	  var sablierContract = new web3.eth.Contract(this.sablierABI, SABLIER_CONTRACT_ADDRESS);

		var gasPrice = toBN(await web3.eth.getGasPrice()).mul(toBN(10)) // Speed up transactions
	  var gasForSending = toBN(await web3.eth.estimateGas({from: sendingAddress, to:controllerAccount.address})).mul(toBN(2))
	  var gasForApproval = toBN(await ERC20Contract.methods.approve(SABLIER_CONTRACT_ADDRESS, amount.toString()).estimateGas({from: sendingAddress})).mul(toBN(2))
	  var gasForERC20Transfer = toBN(await ERC20Contract.methods.transfer(controllerAccount.address, amount.toString()).estimateGas({from: sendingAddress})).mul(toBN(2))
	  var gasForStreamCreation = toBN(500000)
	  // estimateGas doesn't work with web3 for sablier createStream currently; seems to use about 250,000 gas
    // estimateGas needs a bit of margin (* 2) to prevent failures from small misestimations if state of contract changes.
    // be sure to add {from: ...} to estimateGas to prevent misestimation that depends on amounts.

	  var sendingTxFee = gasForSending.mul(gasPrice)
	  var approvalTxFee = gasForApproval.mul(gasPrice)
	  var ERC20TransferTxFee = gasForERC20Transfer.mul(gasPrice)
	  var streamCreationTxFee = gasForStreamCreation.mul(gasPrice)

		var isApprovalNeeded = toBN(await ERC20Contract.methods.allowance(controllerAccount.address, SABLIER_CONTRACT_ADDRESS).call()).lt(amount)
		var numTokensRequired = amount.sub(toBN(await ERC20Contract.methods.balanceOf(controllerAccount.address).call()))
		var areTokensRequired = numTokensRequired.gt(toBN(0))

		var controllerGasRequired = streamCreationTxFee
		if (isApprovalNeeded) controllerGasRequired = controllerGasRequired.add(approvalTxFee)
		var totalGasRequired = controllerGasRequired.add(sendingTxFee)
		if (areTokensRequired) totalGasRequired = totalGasRequired.add(ERC20TransferTxFee)

		var senderBalance = toBN(await web3.eth.getBalance(sendingAddress))
		if (senderBalance.lt(totalGasRequired)) {
      this.setState({errorNotification:"Don't have enough ETH for gas for both transactions"})
      this.setState({processStatusState:0})
		}

		// Send gas to the controlling address if it needs it
    var controllerBalance = toBN(await web3.eth.getBalance(controllerAccount.address))
		if (controllerBalance.lt(controllerGasRequired)) {
			var txFeeToSend = controllerGasRequired.sub(controllerBalance).add(sendingTxFee)
	    var gasSendTx = await web3.eth.sendTransaction({
	      from: sendingAddress,
	      to: controllerAccount.address,
	      value: txFeeToSend,
	      gas: gasForSending,
	      gasPrice: gasPrice,
	   })
		}

    this.setState({processStatusState:2})
		if (isApprovalNeeded) { // Approve the Sablier contract to spend the controller's tokens
	    var approveTx = await ERC20Contract.methods.approve(SABLIER_CONTRACT_ADDRESS, amount.toString()).send({
	      from: controllerAccount.address,
	      gas: gasForApproval,
	      gasPrice: gasPrice,
	    })
		}

    this.setState({processStatusState:3})
		if (areTokensRequired) { // Top up the controller's tokens to the requested amount
	    var transferTx = await ERC20Contract.methods.transfer(controllerAccount.address, numTokensRequired.toString()).send({
	      from: sendingAddress,
	      gas: gasForERC20Transfer,
	      gasPrice: gasPrice,
	    })
		}

	  // Create the Sablier stream.
	  // Unfortunately, we can't pre-create this because the contract transfers all tokens immediately.
    this.setState({processStatusState:4})
	  var streamCreateTx = await sablierContract.methods.createStream(payeeAddress, amount.toString(), ERC20_CONTRACT_ADDRESS, startTime.toString(), endTime.toString()).send({
	    from: controllerAccount.address,
	    gas: gasForStreamCreation,
	    gasPrice: gasPrice,
	  })

    this.setState({processStatusState:5}) // Success

	  const streamID = streamCreateTx.events.CreateStream.returnValues.streamId
	  const transactionHash = streamCreateTx.transactionHash
	  return {streamID, transactionHash}
	}

  async canDeletePrivateKey(account) {
    var getTokenBalances = tokenList.map(async (item) => {
      var ERC20Contract = new web3.eth.Contract(this.erc20ABI, item.address);
      try {
        var balance = toBN(await ERC20Contract.methods.balanceOf(account.address).call())
        return [item, balance]
      }
      catch {
        console.log("Error loading balance for " + item.name + " ( " + item.address + " ) ")
        // Not sure why these somtimes fail, and means that key could possiblity be deleted with tokens
      }
    })
    var res = await Promise.all(getTokenBalances)

    var nonZeroBalances = res.filter(item => item && !item[1].isZero())
    if (nonZeroBalances.length > 0) {
      return {can: false, nonZeroBalances}
    }
    else {
      return {can: true}
    }

  }

  async attemptDeletePrivateKey() {
    var canDeleteResult = await this.canDeletePrivateKey(this.state.controllerAccount)
    if (canDeleteResult.can == false) {
      var balanceString = canDeleteResult.nonZeroBalances.map(item => {
        BigNumber.config({ EXPONENTIAL_AT: item[0].decimals })
        return this.convertRealTokenAmount(item[1], item[0]) + " " + item[0].symbol + ", "
      })
      balanceString = balanceString.join()
      this.setState({errorNotification: "Didn't delete: there are still tokens left in the controller account — " + balanceString + " — create new streams to zero them."})
      this.setState({processStatusState: 0})
    } else {
      this.deletePrivateKey()
    }
  }

  deletePrivateKey() {
      web3.eth.accounts.wallet.clear()
      window.localStorage.setItem("savedKey", null)
      if (this.state.controllerAccount) this.state.controllerAccount.privateKey = null
      this.loadSavedState()
      this.setState({successNotification: "Successfully overwrote private key with new temporary account"})
      this.setState({processStatusState: 0})
  }
}


function DateRangePicker(props) {
  const [css, theme] = useStyletron()
  const [dates, setDates] = [props.dates, props.setDates]
  const pickerButtonStyle = {minWidth: '140px', width:"140px", marginRight: theme.sizing.scale300}
  const FormControlBottomless = props => {return (
    <FormControl
      {...props}
      overrides={{
        ControlContainer: {
          style: ({ $theme }) => ({
              marginBottom: "0px"
            })
          }
        }}
    />
  )};
  const defaultTime = (new Date()).getTime() + (15*60*1000)
  return (
    <div style={{display: 'flex', alignItems: 'center', flexWrap: "wrap"}}>
      <div style={{display: 'flex', alignItems: 'center'}}>
      <div style={pickerButtonStyle}>
        <FormControl
          label="Start Date"
          >
          <Datepicker
            value={[dates[0]]}
            minDate = {Date.now()}
            onChange={({date}) => {
              var newDate = new Date(dates[0] || defaultTime)
              if (date) {
                newDate.setDate(date.getDate())
                newDate.setMonth(date.getMonth())
                newDate.setFullYear(date.getFullYear())
                setDates([newDate, dates[1]])
              }
            }}
            mask="9999/99/99"
            error={props.error}
            disabled={props.disabled}
            />
        </FormControl>
      </div>
      <div style={pickerButtonStyle}>
        <FormControl label="Start Time" >
          <TimePicker
            value={dates[0]}
            onChange={time => setDates([time, dates[1]])}
            creatable
            error={props.error}
            disabled={props.disabled}
            />
        </FormControl>
      </div>
      <div style={{marginTop: "20px", marginRight: theme.sizing.scale300}}>
        <ArrowRight size={24} />
      </div>
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
      <div style={pickerButtonStyle}>
        <FormControl label="End Date">
          <Datepicker
            value={dates[1]}
            minDate={dates[0] || Date.now()}
            onChange={({date}) => {
              var newDate = new Date(dates[1] || defaultTime)
              if (date) {
                newDate.setDate(date.getDate())
                newDate.setMonth(date.getMonth())
                newDate.setFullYear(date.getFullYear())
                setDates([dates[0], newDate])
              }
            }}
            mask="9999/99/99"
            error={props.error}
            disabled={props.disabled}
            />
        </FormControl>
      </div>
      <div style={{minWidth: "140px"}}>
        <FormControl label="End Time">
          <TimePicker
            value={dates[1]}
            onChange={time => setDates([dates[0], time])}
            creatable
            error={props.error}
            disabled={props.disabled}
            />
        </FormControl>
      </div>
      </div>
    </div>
  );
};

const THEME = LightTheme
const engine = new Styletron();
ReactDOM.render((
	<StyletronProvider value={engine}>
		<BaseProvider theme={THEME}>
			<App/>
		</BaseProvider>
	</StyletronProvider>
), document.getElementById('root'));
