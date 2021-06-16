import { DataHeader } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import * as blockies from "blockies-ts";
import * as d3 from "d3";
import { Chain } from "./chain";
import { Flash } from "./flash";

export class Utils {
    /**
     * Convert bytes to string.
     * @param b buffer to convert
     */
    static bytes2String(b: Buffer): string {
        return b.toString("hex");
    }

    /**
     * Convert string to bytes.
     * @param hex string to convert
     */
    static hex2Bytes(hex: string) {
        if (!hex) {
            return Buffer.allocUnsafe(0);
        }

        return Buffer.from(hex, "hex");
    }

    /**
     * Generate a random color in HEX format.
     * Source: https://stackoverflow.com/a/1152508
     */
    static getRandomColor() {
        return (
            "#" +
            (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
        );
    }

    /**
     * Get the hash of the previous (left) block.
     * @param block block of which we want the hash of the left block
     */
    static getLeftBlockHash(block: SkipBlock): string {
        return this.bytes2String(block.backlinks[0]);
    }

    /**
     * Get the hash of the next (right) block.
     * @param block block of which we want the hash of the right block
     */
    static getRightBlockHash(block: SkipBlock): string {
        return this.bytes2String(block.forwardLinks[0].to);
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Get the skipBlock by its hash and roster
     * @param hash the hash the requested block
     * @param roster roster that validated the block
     */
    static async getBlock(hash: Buffer, roster: Roster): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
                .getSkipBlock(hash)
                .then((skipblock) => resolve(skipblock))
                .catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Gets the skipBlock by its hash and roster
     * @param genesis hash of the first block of the chain
     * @param index the index of the requested block
     * @param roster roster that validated the block
     */
    static async getBlockByIndex(
        genesis: Buffer,
        index: number,
        roster: Roster
    ): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
                .getSkipBlockByIndex(genesis, index)
                .then((skipblock) => resolve(skipblock.skipblock))
                .catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     *
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Formats and outputs the date at which a block was validated
     * @param block block of which we want the validation time
     */
    static getTimeString(block: SkipBlock): string {
        const timestamp = Number(DataHeader.decode(block.data).timestamp);
        const date = new Date(timestamp / 1000_000);
        const hours = date.getHours();
        const minutes = "0" + date.getMinutes();
        const seconds = "0" + date.getSeconds();

        return (
            date.toISOString().slice(0, 10) +
            " at " +
            hours +
            ":" +
            minutes.substr(-2) +
            ":" +
            seconds.substr(-2)
        );
    }

    static trigger(id: string): void {
        alert(id);
    }

    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Takes a string and copies it to clipboard, notify it has been done afterwards.
     * To work with all browsers, this needs to be called after an event generated by a user (a click for instance)
     * @param str string to copy to clipboard
     * @param flash flash used to display a notification on
     */
    static copyToClipBoard(str: string, flash: Flash): void {
        const dummy = document.createElement("textarea");
        dummy.value = str;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        flash.display(Flash.flashType.INFO, "Copied to clipboard");
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Translates the chain to the given block.
     * @param goalBlock
     * @param initialBlock
     * @param blockClickedSubject
     */
    static async translateOnChain(goalBlock: number, initialBlock: number) {
        // translate the chain to wanted coordinates
        const newZoom = d3.zoomIdentity
            .translate(
                //-5 because we want to land in the middle of the chain
                -(goalBlock - 5) * Chain.unitBlockAndPaddingWidth + 0.2,
                0
            )
            .scale(1);

        /**
         * Adds an animation and then calls the transformation
         * @author Lucas Trognon (lucas.trognon@epfl.ch)
         */
        d3.select("#svg-container")
            .transition()
            .delay(200)
            .duration(1000)
            .call(Chain.zoom.transform, newZoom);
    }

    /**
     * @author Noémien Kocher (noémien.kocher@epfl.ch)
     *
     * Converts a transform to the corresponding block index.
     * @param transform d3 transformation
     * @param blockWidth width of a block, with the padding included
     * @param chainWidth the width of the chain
     */
    static transformToIndexes(
        transform: any,
        blockWidth: number,
        chainWidth: number
    ): { left: number; right: number } {
        const x = -transform.x;
        const zoomLevel = transform.k;

        const leftBlockIndex = x / (blockWidth * zoomLevel);
        const rightBlockIndex =
            chainWidth / (blockWidth * zoomLevel) + leftBlockIndex;

        return { left: Math.max(0, leftBlockIndex), right: rightBlockIndex };
    }

    /**
     *  @author Lucas Trognon (lucas.trognon@epfl.ch)
     *
     * Adds a clickable squared blocky image to a d3 selection. Should be used to represent an object.
     * @param line d3 selection
     * @param hash seed for the blocky
     * @param flash flash object used for the copy to clipboard notification.
     * */

    static addHashBlocky(
        line: d3.Selection<HTMLElement, unknown, HTMLElement, any>,
        hash: string,
        flash: Flash
    ) {
        const blocky = blockies.create({ seed: hash });
        line.append("img")
            .attr("class", "uk-img")
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function () {
                Utils.copyToClipBoard(hash, flash);
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });
    }

    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     *
     *
     * Adds a clickable rounded blocky image to a d3 selection. Should be used to represent a user.
     * @param line d3 selection
     * @param hash seed for the blocky
     * @param flash flash object used for the copy to clipboard notification.
     */
    static addIDBlocky(
        line: d3.Selection<HTMLElement, unknown, HTMLElement, any>,
        hash: string,
        flash: Flash
    ) {
        const blocky = blockies.create({ seed: hash });
        line.append("img")
            .attr("class", "uk-img clip-blocky")
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function () {
                Utils.copyToClipBoard(hash, flash);
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });
    }
    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Changes the pointer dynamically when the user hover an element to indicate it is interactive
     * @param item d3 Selection, preferably of a clickable field.
     */
    static clickable(
        item: d3.Selection<HTMLElement, unknown, HTMLElement, any>
    ) {
        item.on("mouseover", function () {
            d3.select(this).style("cursor", "pointer");
        }).on("mouseout", function () {
            d3.select(this).style("cursor", "default");
        });
    }

    /**
     * @author Rosa José Sara
     * @returns the svg script for the download icon
     */
    static downloadIconScript(): string {
        return `<svg viewBox="0 0 983 962" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;">
        <g transform="matrix(-0.957787,0.406581,-0.590533,-0.752044,3103.91,1811.35)">
            <path d="M1155.03,2714.41C1170.1,2886.92 991.944,2915.2 912.412,2865.58C832.879,2815.96 777.954,2711.51 866.2,2621.87C772.313,2628.14 725.686,2554.84 741.327,2472.55C759.019,2379.46 827.77,2317.71 927.981,2322.22C853.973,2282.21 890.359,2067.84 1059.26,2077.12C1111.96,2080.02 1189.08,2121.62 1252.17,2155.73C1285.9,2173.96 1302.58,2183.73 1302.58,2183.73" style="fill:none;stroke-width:48.29px;"/>
        </g>
        <g transform="matrix(-0.957787,0.406581,-0.590533,-0.752044,3085.54,1811.35)">
            <path d="M1436.26,2289.36C1436.26,2289.36 1492.51,2319.71 1534.2,2342.25C1568.65,2360.88 1597.86,2388.63 1612.87,2427.29C1667.9,2569.03 1521.93,2739.32 1361.07,2659.61C1440.51,2746.17 1415.7,2825.59 1378.53,2871.73C1341.35,2917.87 1242.68,2973.01 1142.98,2907.35" style="fill:none;stroke-width:48.29px;"/>
        </g>
        <g transform="matrix(1,0,0,1,-3916.53,-1953.26)">
            <g transform="matrix(0.428312,-0.428312,0.428312,0.428312,1930.88,2695.11)">
                <path d="M2635.61,2829.81L2635.61,3085.72L2891.52,3085.72" style="fill:none;stroke-width:89.42px;"/>
            </g>
            <g transform="matrix(1,0,0,1,1544.84,-129.382)">
                <path d="M2836.56,2986.15L2836.56,2558.74" style="fill:none;stroke-width:54.17px;"/>
            </g>
        </g>
    </svg>`;
    }
}
