import React from "react";
import { FaCheckCircle, FaCrown, FaLock, FaTimes } from "react-icons/fa";
import "./LockedCard.css";

const PremiumLockedCard = React.forwardRef(
  (
    {
      title,
      message,
      bullets = [],
      onUpgrade,
      onClose,
      compact = false,
      className = "",
      closeLabel = "Затвори Premium прозореца",
    },
    ref
  ) => {
    const handleUpgrade = (event) => {
      event.stopPropagation();
      onUpgrade?.(event);
    };

    const handleClose = (event) => {
      event.stopPropagation();
      onClose?.(event);
    };

    return (
      <div
        ref={ref}
        className={`locked-card locked-card--premium${compact ? " locked-card--compact" : ""}${className ? ` ${className}` : ""}`}
      >
        <div className="locked-card__glow locked-card__glow--premium" />

        {onClose ? (
          <button type="button" onClick={handleClose} aria-label={closeLabel} className="locked-card__close">
            <FaTimes />
          </button>
        ) : null}

        <div className="locked-card__content">
          <div className="locked-card__badge locked-card__badge--premium">
            <FaCrown /> Premium функция
          </div>

          <div className="locked-card__layout">
            <div className="locked-card__icon locked-card__icon--premium">
              <FaLock />
            </div>
            <div className="locked-card__body">
              <h3 className="locked-card__title">{title}</h3>
              <p className="locked-card__message">{message}</p>
              {bullets.length > 0 ? (
                <ul className="locked-card__list">
                  {bullets.map((bullet) => (
                    <li key={bullet}>
                      <FaCheckCircle className="locked-card__check" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button type="button" onClick={handleUpgrade} className="locked-card__button locked-card__button--premium">
                <FaCrown /> Надгради до Premium
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default PremiumLockedCard;
