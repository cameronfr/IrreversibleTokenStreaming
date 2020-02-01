# Irreversible Token Streaming

This is a [webapp](https://tokenstreaming.colorsleep.com/) that lets you setup a [Sablier](https://github.com/sablierhq/sablier) [contract](https://etherscan.io/address/0xA4fc358455Febe425536fd1878bE67FfDBDEC59a#code) and then throw away the private key.

Built with [this](https://gitcoin.co/issue/sablierhq/sablier/30/3874) Gitcoin challenge in mind.

## Site
- MainNet: https://tokenstreaming.colorsleep.com/
- Kovan: https://tokenstreaming.colorsleep.com/
The site will switch between Mainnet and Kovan automatically.

## Features
- the private key cannot be lost (even after page reloading) until 
  1. the Sablier stream is verified to be created and 
  2. the temporary account has no ERC20 tokens (all available are checked) left in it
- all conditions of the Sablier contract are validated client-side with every input
- the last transaction that needs to be approved is the one that transfers the tokens
- everything happens in the browser and only one blockchain contract (the main Sablier contract) is involved
- simple source and simple client frontend

## Testing
- To get ETH on Ropsten, go to [this faucet](https://faucet.ropsten.be/). 
- To get TST (the ERC20 token used for testing), go to [this contract](https://ropsten.etherscan.io/address/0x722dd3f80bac40c951b51bdd28dd19d435762180#writeContract) and call the `showMeTheMoney` function, which can be done through etherscan with MetaMask. 

The Kovan testnet version of the Sablier contract is [here](https://ropsten.etherscan.io/address/0xc04Ad234E01327b24a831e3718DBFcbE245904CC).

## Danger
- if the recipient calls the `cancelStream(...)` of the Sablier contract
- if the creator leaves the page after transferring the tokens but before `createStream(...)` is called **AND** manages to delete the temporarily saved (and obsufcated) key in `localStorage`

## Building

`yarn global add parcel-bundler` and then `parcel watch index.html`, be sure to start a server at `dist` e.g. `python -m http.server --bind 0.0.0.0 1234` and to move the static `tokenIcons` folder to the `dist` folder.
