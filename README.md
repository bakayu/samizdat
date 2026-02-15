# Samizdat Protocol

**Decentralized Digital Signage Network (DePIN) on Solana.**
A "Sovereign Frame Buffer" that decouples content storage from rendering. Advertisers fund campaigns on-chain; hardware owners (Screens) poll for content, render it, and submit cryptographic proofs to claim bounties.

## Architecture

> [!IMPORTANT]
> The current architecture is for reference only, the end product might look different.

### System Overview
Advertisers interact with the blockchain to fund campaigns. Screens (Physical or Virtual) act as autonomous agents that poll the chain, filter content via local policies, and sign proofs of play to unlock payments.

```mermaid
flowchart TB
    %% Styles
    classDef user fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef program fill:#fff9c4,stroke:#fbc02d,stroke-width:2px,rx:5,ry:5
    classDef pda fill:#ffecb3,stroke:#ff6f00,stroke-width:2px,stroke-dasharray: 5 5
    classDef storage fill:#e0e0e0,stroke:#616161,stroke-width:2px,shape:cylinder
    classDef hardware fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px

    subgraph User_Space ["User / Web Space"]
        Advertiser((Advertiser)):::user
        Wallet[Wallet App]:::user
    end

    subgraph On_Chain ["Solana Protocol Layer"]
        Samizdat[Samizdat Program]:::program
        
        subgraph Accounts ["Program State"]
            AdPDA["AdAccount PDA<br/>Owner: Advertiser<br/>Data: CID, Bounty"]:::pda
            ScreenPDA["ScreenAccount PDA<br/>Owner: Host<br/>Data: Signer Key"]:::pda
        end
    end

    subgraph External ["External Storage"]
        Arweave[(Arweave Network)]:::storage
    end

    subgraph DePIN ["DePIN Hardware Layer"]
        Renderer[Renderer Client]:::hardware
        Policy["Policy.json<br/>(Local Filter)"]:::hardware
    end

    %% Connections
    Advertiser -- "1. Uploads Media" --> Arweave
    Arweave -- "Returns CID" --> Advertiser
    Advertiser -- "2. Init Transaction" --> Wallet
    Wallet -- "3. Sign & Send" --> Samizdat
    Samizdat -- "Allocates" --> AdPDA
    Samizdat -- "Allocates" --> ScreenPDA
    
    Renderer -- "4. Polls State" --> AdPDA
    Renderer -- "5. Fetches Content" --> Arweave
    Renderer -- "6. Submits Proof" --> Samizdat
    Samizdat -- "7. Settles Payment" --> Wallet
```

### Ad Creation

```mermaid
sequenceDiagram
    autonumber
    participant User as Advertiser
    participant Arweave as Arweave (Storage)
    participant Wallet as Wallet (Phantom)
    participant Program as Samizdat Program
    participant AdPDA as AdAccount (PDA)

    Note over User, Arweave: Phase 1: Content Storage
    User->>Arweave: Upload Media File
    Arweave-->>User: Return Content ID (CID)

    Note over User, AdPDA: Phase 2: On-Chain Initialization
    User->>Wallet: Build Tx: initialize_ad_campaign(CID, Budget)
    Wallet->>Program: Sign & Send Transaction
    activate Program
    Note right of Program: Derivation: hash(CreatorKey + CampaignID)
    Program->>AdPDA: Allocate Space (Rent Exempt)
    Program->>AdPDA: Initialize Data:<br/>- Authority: User<br/>- Content: CID<br/>- Bounty: 0.01 SOL
    Program->>AdPDA: Transfer SOL (Budget) from User
    deactivate Program
    Note over AdPDA: Campaign is now LIVE
```

### Hardware Registration and Polling

```mermaid
flowchart TD
    %% Classes
    classDef logic fill:#ffffff,stroke:#333,stroke-width:1px,shape:rhombus
    classDef action fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef state fill:#fff3e0,stroke:#e65100,stroke-width:2px

    subgraph Loop ["Part B: The Polling Cycle"]
        Device[Renderer Device]:::action -->|RPC Query| Program
        Program -->|Return List| AdList[Active AdAccounts]:::state
        
        AdList --> Filter{Check Policy.json}:::logic
        Filter -- "Banned/Low Bid" --> Ignore[Discard Ad]:::action
        Filter -- "Allowed" --> Fetch[Fetch Media via CID]:::action
        
        Fetch -->|Download| Arweave[(Arweave)]:::state
        Arweave -->|Raw Data| Display[Render to Screen]:::action
    end

    subgraph Setup ["Part A: Registration"]
        Host[Host Wallet]:::action -->|instruction: register_screen| Program[Samizdat Program]:::state
        Program -->|Derive Address| ScreenPDA[ScreenAccount PDA<br/>Stores: Signing Key]:::state
    end

```

### Proof of Play and Settlement

```mermaid
flowchart TB
    %% Classes
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef decision fill:#ffffff,stroke:#d50000,stroke-width:2px,shape:rhombus
    classDef success fill:#c8e6c9,stroke:#1b5e20,stroke-width:2px
    classDef fail fill:#ffcdd2,stroke:#b71c1c,stroke-width:2px

    Start([Media Finish Playing]) --> Generate[Generate Signature<br/>Payload: AdID + Timestamp]:::process
    Generate --> Submit[Tx: submit_proof]:::process
    Submit --> Program[Samizdat Program]

    subgraph Validation ["On-Chain Validation Logic"]
        direction TB
        Program --> CheckSig{Valid Signature?}:::decision
        CheckSig -- No --> Error1[Revert: Invalid Auth]:::fail
        CheckSig -- Yes --> CheckTarget{Targeting Match?}:::decision
        CheckTarget -- No --> Error2[Revert: Targeting Mismatch]:::fail
        CheckTarget -- Yes --> CheckFunds{Funds > Bounty?}:::decision
        CheckFunds -- No --> Error3[Close Campaign / Revert]:::fail
    end

    subgraph Settlement ["Settlement (CPI)"]
        direction TB
        CheckFunds -- Yes --> Transfer[Transfer SOL<br/>From: AdAccount PDA<br/>To: Host Wallet]:::success
        Transfer --> Update[Update AdAccount:<br/>- Decrement Balance<br/>- Increment Play Count]:::process
    end
```


