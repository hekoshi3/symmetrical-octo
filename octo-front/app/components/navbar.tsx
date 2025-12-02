import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 left-0 z-50 w-full bg-neutral-800 text-white md:px-8 border-b border-neutral-700">
      <div className="w-full flex justify-between items-center md:px-8 py-1 sm:px-2">
        {/* Left Section */}
        <section className="flex space-x-2">
          <Link href="/" className="text-lg font-semibold hover:underline">
            <Image src={'/img/nacho.png'} height={40} width={40} alt=""></Image>
          </Link>
        </section>

        {/* Middle Section */}
        <section className="flex justify-center">
          SEARCH (NOT IMPLEMENTED)
        </section>

        {/* Right Section */}
        <section className="flex space-x-6">
          <Link href="/" className="hover:underline">
            Generate
          </Link>
          <Link href="/upload" className="hover:underline">
            Upload
          </Link>
          <Link href="/user" className="hover:underline">
            User
          </Link>
        </section>
      </div>
    </header>
  );
}
