import Image from "next/image"
import { GalleryImage } from "../components/interfaces/GalleryImage";
import Link from "next/link";

export const imgCard = (img: GalleryImage, index: number, setClicked: () => Promise<unknown>) => {
    console.log("Got"+img.seed)
    return (
        <div key={index} className="relative grid bg-neutral-primary-soft min-w-70 md:max-w-80 rounded-lg hover:scale-101">
            <Link href={img.path} target="_blank" rel="noopener noreferrer" className="place-items-center">
                <Image
                    src={img.path}
                    alt={`Generated ${index}`}
                    width={512}
                    loading="lazy"
                    height={Math.round(512 * (img.height / img.width))}
                    className="object-cover object-center rounded-lg md:max-h-100 lg:min-h-100"
                />
                <div className="absolute rounded-b-md inset-0 bg-linear-to-b to-neutral-950 z-0" />
            </Link>
            <div className="flex flex-col absolute top-0 right-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="dropdown dropdown-end pt-2 pr-2">
                    <div tabIndex={0} role="button" className="bg-black/30 cursor-pointer rounded-sm p-2">
                    <Image className="" src={"/menu-white.svg"} alt="" width={18} height={18}></Image></div>
                    <div tabIndex={-1} className="dropdown-content menu bg-neutral-800 rounded-box z-1 p-2 mr-2 shadow-sm overflow-hidden">
                        <ul>
                            <li className="truncate">Model: {img.modelname ? img.modelname : "N/A"}</li>
                            <li className="truncate">Sampler: {img.sampler ? img.sampler : "N/A"}</li>
                            <li className="truncate">Sheduler: {img.sheduler ? img.sheduler : "N/A"}</li>
                            <li className="truncate">Seed: {img.seed ? img.seed : "N/A"}</li>
                            <li className="truncate">Width: {img.width ? img.width : "N/A"}</li>
                            <li className="truncate">Height: {img.height ? img.height : "N/A"}</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="flex flex-col absolute bottom-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="pl-5 mb-5">
                    <Link href="#" className="">
                        <Image src={"/img/nacho.png"} alt="" width={32} height={32} className="rounded-full"></Image>
                        <div>
                            <h4 className="text-2xl font-semibold tracking-tight text-heading truncate">Hekoshi</h4>
                            <h5 className="text-xl tracking-tight truncate">0 подписчиков</h5>
                        </div>
                    </Link>
                </div>
                <div className="pl-10 lg:pl-5 h-10 scale-150 lg:scale-100">
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2" onClick={() => setClicked()}>
                        <Image className="m-2" src={"/heart-full-white.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2" onClick={() => setClicked()}>
                        <Image className="m-2" src={"/heart-white.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2" onClick={() => setClicked()}>
                        <Image className="m-2" src={"/heart-full-black.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2" onClick={() => setClicked()}>
                        <Image className="m-2" src={"/heart-black.svg"} alt="" width={16} height={16}></Image>
                    </button>
                </div>
            </div>
        </div>
    )
};

