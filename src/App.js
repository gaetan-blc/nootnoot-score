import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { contractAddress, contractAbi } from './constants/contractConfig';
import './App.css';

function App() {
  const [provider, setProvider] = useState(null);
  console.log('Unused:', provider); // Added for unused variable
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Contract State Variables
  const [owner, setOwner] = useState('');
  console.log('Unused:', owner); // Added for unused variable
  const [tokenAddress, setTokenAddress] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  console.log('Unused:', isPaused); // Added for unused variable
  const [lastTournamentId, setLastTournamentId] = useState(null);
  console.log('Unused:', lastTournamentId); // Added for unused variable
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // UI State
  const [tournamentIdInput, setTournamentIdInput] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [durationInput, setDurationInput] = useState('600'); // Default 10 mins
  console.log('Unused:', setDurationInput); // Added for unused variable
  const [newTokenAddressInput, setNewTokenAddressInput] = useState('');
  console.log('Unused:', setNewTokenAddressInput); // Added for unused variable
  const [depositAmountInput, setDepositAmountInput] = useState('');
  console.log('Unused:', setDepositAmountInput); // Added for unused variable
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Define fetchTournamentDetails before it's used in fetchContractData
  const fetchTournamentDetails = useCallback(async (id) => {
      if (!contract || !id) {
          setTournamentDetails(null);
          setLeaderboard([]);
          return;
      };
      setLoading(true);
      setError('');
      try {
          const idBN = ethers.BigNumber.from(id);
          const [details, board] = await Promise.all([
              contract.tournaments(idBN),
              contract.getLeaderboard(idBN)
          ]);

          setTournamentDetails({
              startTime: new Date(details.startTime.toNumber() * 1000).toLocaleString(),
              endTime: new Date(details.endTime.toNumber() * 1000).toLocaleString(),
              prizeAmount: ethers.utils.formatUnits(details.prizeAmount, 18), // Assuming 18 decimals for ERC20
              isActive: details.isActive,
              winner: details.winner === ethers.constants.AddressZero ? 'None' : details.winner,
          });

          setLeaderboard(board.map(p => ({
              player: p.player,
              score: p.score.toString(),
          })));

      } catch (err) {
          console.error(`Error fetching details for tournament ${id}:`, err);
          setError(err.message || `Failed to fetch data for tournament ${id}.`);
          setTournamentDetails(null);
          setLeaderboard([]);
      } finally {
          setLoading(false);
      }
  }, [contract]);

  // Now define fetchContractData after fetchTournamentDetails
  const fetchContractData = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setError('');
    try {
      const [
        currentOwner,
        currentTokenAddress,
        pausedStatus,
        idCounter
      ] = await Promise.all([
        contract.owner(),
        contract.token(),
        contract.paused(),
        contract.tournamentIdCounter()
      ]);
      setOwner(currentOwner);
      setTokenAddress(currentTokenAddress);
      setIsPaused(pausedStatus);

      const lastId = idCounter.gt(0) ? idCounter.sub(1) : null;
      setLastTournamentId(lastId !== null ? lastId.toString() : null);

      if (lastId !== null && !tournamentIdInput) {
          setTournamentIdInput(lastId.toString()); // Default to last tournament
          await fetchTournamentDetails(lastId.toString()); // Fetch details for default
      } else if (tournamentIdInput) {
          await fetchTournamentDetails(tournamentIdInput);
      }

    } catch (err) {
      console.error("Error fetching contract data:", err);
      setError(err.message || 'Failed to fetch contract data.');
    } finally {
        setLoading(false);
    }
  }, [contract, tournamentIdInput, fetchTournamentDetails]);

  // --- Wallet Connection ---

  const connectWallet = useCallback(async () => {
    setError('');
    setSuccessMessage('');
    if (typeof window.ethereum !== 'undefined') {
      try {
        setLoading(true);
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        await web3Provider.send("eth_requestAccounts", []); // Request account access
        const web3Signer = web3Provider.getSigner();
        const connectedAccount = await web3Signer.getAddress();
        const network = await web3Provider.getNetwork();

        // --- Add network check if needed ---
        // const targetChainId = '0xaa36a7'; // Example: Sepolia Chain ID
        // if (network.chainId !== parseInt(targetChainId)) {
        //     setError(`Please connect to the correct network (e.g., Sepolia). Current: ${network.name} (${network.chainId})`);
        //     setLoading(false);
        //     setIsConnected(false);
        //     return;
        // }
        // --- End network check ---
	const targetChainId = '0x2B74'; // <-- Abstract Testnet Chain ID (11124 decimal)
if (network.chainId !== parseInt(targetChainId, 16)) { // Parse hex ID
    // Update the error message to be specific
    setError(`Please connect to the correct network (Abstract Testnet - Chain ID ${parseInt(targetChainId, 16)}). Current: ${network.name} (${network.chainId})`);
    setLoading(false);
    setIsConnected(false);
    // Clear contract state if network is wrong
    setContract(null);
    setOwner('');
    setTokenAddress('');
    // ... reset other state ...
    return; // Stop connection process
}


        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(connectedAccount);
        setIsConnected(true);
        setLoading(false);
        console.log("Wallet Connected:", connectedAccount);

        // Instantiate contract
        const bombermanContract = new ethers.Contract(contractAddress, contractAbi, web3Signer);
        setContract(bombermanContract);

      } catch (err) {
        console.error("Wallet connection failed:", err);
        setError(err.message || 'Failed to connect wallet.');
        setIsConnected(false);
        setLoading(false);
      }
    } else {
      setError("MetaMask (or compatible wallet) not found. Please install it.");
      setIsConnected(false);
    }
  }, []);

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContract(null);
    setIsConnected(false);
    // Reset contract specific state
    setOwner('');
    setTokenAddress('');
    setIsPaused(false);
    setLastTournamentId(null);
    setTournamentDetails(null);
    setLeaderboard([]);
    setError('');
    setSuccessMessage('');
    console.log("Wallet Disconnected");
  };

  useEffect(() => {
    // Read query parameters from the URL when the component mounts
    const queryParams = new URLSearchParams(window.location.search);
    const scoreFromUrl = queryParams.get('score'); // Get the value of 'score'

    if (scoreFromUrl) {
      // Optional: Add some basic validation if desired
      const scoreNum = parseInt(scoreFromUrl, 10);
      if (!isNaN(scoreNum) && scoreNum >= 0) {
        setScoreInput(scoreFromUrl); // Set the input field state
        console.log(`Score loaded from URL parameter: ${scoreFromUrl}`);
      } else {
        console.warn(`Invalid score value ('${scoreFromUrl}') found in URL query parameter.`);
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          console.log('Account changed:', accounts[0]);
          // Re-connect with the new account
          connectWallet();
        } else {
          console.log('Wallet disconnected by user.');
          disconnectWallet();
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Optional: Handle chain changes
      const handleChainChanged = (chainId) => {
        console.log('Network changed to:', chainId);
        // Reload or prompt user to reconnect/switch network
        window.location.reload(); // Simple reload approach
      };
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [connectWallet]);


  // --- Contract Interaction Functions ---

  // Fetch data on connect or contract change
  useEffect(() => {
    if (contract) {
      fetchContractData();
    }
  }, [contract, fetchContractData]);

   // Fetch tournament details when tournamentIdInput changes
   useEffect(() => {
      fetchTournamentDetails(tournamentIdInput);
   }, [tournamentIdInput, fetchTournamentDetails]);


  // Helper for transactions
  const executeTransaction = async (func, ...args) => {
    if (!contract || !signer) {
      setError("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      console.log(`Executing ${func.name} with args:`, args);
      const tx = await func(...args);
      setSuccessMessage(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait(); // Wait for transaction confirmation
      setSuccessMessage(`Transaction confirmed: ${tx.hash}`);
      // Refetch data after successful transaction
      await fetchContractData();
    } catch (err) {
      console.error("Transaction failed:", err);
      const reason = err.reason || err.message || 'Transaction failed.';
      setError(`Error: ${reason}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Call Contract Functions ---
  const handleCreateTournament = () => {
    executeTransaction(contract.createTournament, ethers.BigNumber.from(durationInput));
  };
  console.log('Unused:', handleCreateTournament); // Added for unused variable

  const handleEndTournament = () => {
    if (!tournamentIdInput) { setError("Please enter a Tournament ID"); return; }
    executeTransaction(contract.endTournament, ethers.BigNumber.from(tournamentIdInput));
  };
  console.log('Unused:', handleEndTournament); // Added for unused variable

  const handleSubmitScore = () => {
    if (!tournamentIdInput) { setError("Please enter a Tournament ID"); return; }
    if (!scoreInput) { setError("Please enter a score"); return; }
    executeTransaction(contract.submitScore, ethers.BigNumber.from(tournamentIdInput), ethers.BigNumber.from(scoreInput));
  };

  const handleClaimPrize = () => {
    if (!tournamentIdInput) { setError("Please enter a Tournament ID"); return; }
    executeTransaction(contract.claimPrize, ethers.BigNumber.from(tournamentIdInput));
  };

  const handleSetToken = () => {
    if (!ethers.utils.isAddress(newTokenAddressInput)) { setError("Invalid new token address"); return; }
    executeTransaction(contract.setToken, newTokenAddressInput);
  };
  console.log('Unused:', handleSetToken); // Added for unused variable

  const handleDepositTokens = async () => {
    if (!depositAmountInput || parseFloat(depositAmountInput) <= 0) { setError("Invalid deposit amount"); return; }

    if (!contract || !signer) { setError("Please connect wallet"); return; }
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
         // --- ERC20 Approval Needed ---
        const amountWei = ethers.utils.parseUnits(depositAmountInput, 18); // Assuming 18 decimals
        const tokenContract = new ethers.Contract(tokenAddress, [ // Minimal ERC20 ABI for approve
             "function approve(address spender, uint256 amount) public returns (bool)",
             "function allowance(address owner, address spender) public view returns (uint256)"
        ], signer);

        console.log(`Checking allowance for ${contractAddress} from ${account}`);
        const currentAllowance = await tokenContract.allowance(account, contractAddress);
        console.log(`Current allowance: ${ethers.utils.formatUnits(currentAllowance, 18)}`);


        if (currentAllowance.lt(amountWei)) {
             setSuccessMessage('Approving token spending...');
             console.log(`Approving ${ethers.utils.formatUnits(amountWei, 18)} tokens for spending by ${contractAddress}`);
             const approveTx = await tokenContract.approve(contractAddress, amountWei);
             setSuccessMessage(`Approval sent: ${approveTx.hash}. Waiting for confirmation...`);
             await approveTx.wait();
             setSuccessMessage('Token spending approved!');
        } else {
            console.log('Sufficient allowance already granted.');
        }

        // --- Now Deposit ---
        console.log(`Depositing ${ethers.utils.formatUnits(amountWei, 18)} tokens...`);
        await executeTransaction(contract.depositTokens, amountWei);

    } catch (err) {
         console.error("Deposit process failed:", err);
         const reason = err.reason || err.message || 'Deposit process failed.';
         setError(`Error: ${reason}`);
         setLoading(false); // Ensure loading is stopped on error
    }
    // setLoading is handled by executeTransaction on success/failure of deposit
  };
  console.log('Unused:', handleDepositTokens); // Added for unused variable


  const handlePause = () => {
    executeTransaction(contract.pause);
  };
  console.log('Unused:', handlePause); // Added for unused variable

  const handleUnpause = () => {
    executeTransaction(contract.unpause);
  };
  console.log('Unused:', handleUnpause); // Added for unused variable

   const handleCheckExpired = () => {
     executeTransaction(contract.checkExpiredTournaments);
   };
   console.log('Unused:', handleCheckExpired); // Added for unused variable


  // --- Render ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>Bomberman Tournament DApp</h1>
        {!isConnected ? (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div>
            <p>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
            <button onClick={disconnectWallet}>Disconnect Wallet</button>
          </div>
        )}
         {error && <p className="error">Error: {error}</p>}
         {successMessage && <p className="success">{successMessage}</p>}
         {loading && <p>Processing...</p>}
      </header>

      {isConnected && contract && (
        <main className="App-main">

<section className="actions">
            <h2>Actions</h2>
             <div className="action-group">
                <h3>Submit Score</h3>
                <input
                    type="number"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="Your Score"
                     min="0"
                />
                <button onClick={handleSubmitScore} disabled={loading || !tournamentIdInput}>
                    Submit Score to Tournament {tournamentIdInput || '?'}
                </button>
             </div>
             <div className="action-group">
                 <h3>Claim Prize</h3>
                 <p>(Must be the declared winner of an ended tournament)</p>
                 <button onClick={handleClaimPrize} disabled={loading || !tournamentIdInput}>
                    Claim Prize for Tournament {tournamentIdInput || '?'}
                 </button>
             </div>

          </section>

          <section className="tournament-view">
            <h2>View Tournament</h2>
            <label>
                Tournament ID:
                <input
                    type="number"
                    value={tournamentIdInput}
                    onChange={(e) => setTournamentIdInput(e.target.value)}
                    placeholder="Enter Tournament ID"
                    min="0"
                />
            </label>
             {/* <button onClick={() => fetchTournamentDetails(tournamentIdInput)} disabled={loading || !tournamentIdInput}>
                Fetch Details
             </button> */}

             {tournamentDetails && (
                <div className="tournament-details">
                    <h3>Details (ID: {tournamentIdInput})</h3>
                    <p><strong>Start Time:</strong> {tournamentDetails.startTime}</p>
                    <p><strong>End Time:</strong> {tournamentDetails.endTime}</p>
                    <p><strong>Prize ($NOOT):</strong> {tournamentDetails.prizeAmount}</p>
                    <p><strong>Is Active:</strong> {tournamentDetails.isActive ? 'Yes' : 'No'}</p>
                    <p><strong>Winner:</strong> {tournamentDetails.winner}</p>
                </div>
             )}

             {leaderboard.length > 0 && (
                <div className="leaderboard">
                    <h3>Leaderboard (ID: {tournamentIdInput})</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Sort leaderboard by score descending */}
                            {[...leaderboard]
                                .sort((a, b) => parseInt(b.score) - parseInt(a.score))
                                .map((entry, index) => (
                                <tr key={entry.player}>
                                    <td>{index + 1}</td>
                                    <td>{entry.player.substring(0, 6)}...{entry.player.substring(entry.player.length - 4)}</td>
                                    <td>{entry.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
             {tournamentIdInput && !loading && !tournamentDetails && <p>No data found for Tournament ID {tournamentIdInput}.</p>}
          </section>



        </main>
      )}
    </div>
  );
}

export default App;