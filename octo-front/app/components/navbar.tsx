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
          <form className="max-w-md mx-auto">
            <label className="block mb-2.5 text-sm font-medium text-heading sr-only">Поиск</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                <svg className="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
              </div>
              <input type="search" id="search" className="block w-full pr-20 p-3 ps-10 bg-neutral-secondary-medium border border-neutral-900 rounded-lg text-heading text-sm rounded-base shadow-xs placeholder:text-body" placeholder="Введите запрос" required />
              <button type="button" className="absolute end-1.5 bottom-1.5 text-white bg-brand bg-neutral-900 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded text-xs px-3 py-1.5 focus:outline-none cursor-pointer">Искать</button>
            </div>
          </form>
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
