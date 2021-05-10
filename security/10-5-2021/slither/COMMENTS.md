# Comments

## slither-1.PNG

> Comment about the 'high severity issue'

the beneficiary is whatever is set when the contract is deployed. Only the owner / deployer is able to change this. Beneficiary is the address that will collect the rent fees. As such this is not an issue.

> Comment about the're-entrancy' attack issue

handleRent is designed to be re-entered. That is how all other actions (lend, rent, stop, claim) work. Using a two pointer algorithm we determine how many times to call the handle functions.
