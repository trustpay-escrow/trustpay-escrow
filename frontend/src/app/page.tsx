import WalletConnect from "@/components/WalletConnect";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center md:p-24 p-12 bg-gray-50 text-slate-900">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-12">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-full lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4">
          TrustPay Escrow &nbsp;
          <code className="font-bold">MVP</code>
        </p>
      </div>

      <div className="relative flex place-items-center mb-12">
        <h1 className="md:text-5xl text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 text-center leading-tight">
          Trustless Escrow<br />on Stellar
        </h1>
      </div>

      <WalletConnect />
    </main>
  );
}
