import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { useForm } from "react-hook-form"
import { object, string, number, date, InferType } from 'yup';
import TextField from '@mui/material/TextField';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { Contract, providers, utils } from "ethers"
import { Button } from "@mui/material"
import Head from "next/head"
import React, {useState} from "react"
import styles from "../styles/Home.module.css"

let userSchema = object({
    firstName: string().required(),
    lastName: string().required(),
    age: number().required().positive().integer(),
});

type User = {
    firstName: string,
    lastName: string,
    age: number,
};
  
export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    const { register, handleSubmit, watch, formState: { errors } } = useForm<User>();
    const onSubmit = (data: any) => console.log(data);

    const [newGreeting, setnewGreeting] = useState();

    async function greet() {
        setLogs("Creating your Semaphore identity...")
        await userSchema.validate(watch());

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const provider2 = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider2)
        const newGreeterVar = contract.filters.NewGreeting()
        setnewGreeting(newGreeterVar.address)
        console.log(newGreeterVar.address)

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }

    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>


                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>


                <div>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <TextField label="First Name" color="secondary" focused {...register("firstName", { required: true, maxLength: 20 })} />
                        <TextField label="Second Name" color="secondary" focused {...register("lastName", { required: true, maxLength: 20})} />
                        <TextField label="Age" color="secondary" focused type="number" {...register("age", { min: 18, max: 99 })} />
                        <Button type="submit" variant="contained">SUBMIT</Button>
                    </form>
                </div>

                <div>
                    {newGreeting}
                </div>
            </main>
        </div>
    )
}
