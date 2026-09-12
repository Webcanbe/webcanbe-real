import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Store({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["icon"]} html={"<svg data-framer-name=\"Icon\" class=\"framer-M83D4 framer-l0xs64\" role=\"presentation\" viewBox=\"0 0 24 24\" data-f2c-idx=\"89\"><use href=\"#3658783930\" data-f2c-idx=\"90\"></use></svg>"} />
  )
}
