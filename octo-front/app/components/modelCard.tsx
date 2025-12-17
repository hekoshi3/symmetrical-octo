import Image from "next/image"
import { ModelList } from "./interfaces/ModelList";
import Link from "next/link";

export const modelCard = (model: ModelList, index: number) => {
    return (
        <div key={index} className="relative grid bg-neutral-primary-soft min-w-70 md:max-w-80 rounded-lg hover:scale-101">
            <Link href={model.preview} target="_blank" rel="noopener noreferrer" className="place-items-center">
                <Image
                    src={model.preview}
                    alt={`Generated ${index}`}
                    width={512}
                    loading="lazy"
                    height={Math.round(512 * (model.previewHeight / model.previewWidth))}
                    className="object-cover object-center rounded-lg md:max-h-100 lg:min-h-100"
                />
                <div className="absolute rounded-b-md inset-0 bg-linear-to-b to-neutral-950 z-0" />
            </Link>
            <div className="flex flex-col absolute bottom-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="pl-5 mb-5">
                    <Link href="#" className="">
                        <div className="flex text-left gap-1">
                            <Image src={"/img/nacho.png"} alt="" width={32} height={32} className="rounded-full"></Image>
                            <h5 className="text-xl truncate self-end">Hekoshi</h5>
                        </div>
                        <h4 className="text-2xl font-semibold tracking-tight text-heading truncate">{model.arch ? model.arch : "NoobAI"}</h4>

                    </Link>
                </div>
                <div className="pl-10 lg:pl-5 h-10 scale-150 lg:scale-100">
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2">
                        <Image className="m-2" src={"/heart-full-white.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2">
                        <Image className="m-2" src={"/heart-white.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2">
                        <Image className="m-2" src={"/heart-full-black.svg"} alt="" width={16} height={16}></Image>
                    </button>
                    <button className="bg-white/20 cursor-pointer rounded-sm mr-2">
                        <Image className="m-2" src={"/heart-black.svg"} alt="" width={16} height={16}></Image>
                    </button>
                </div>
            </div>
        </div>
    )
};