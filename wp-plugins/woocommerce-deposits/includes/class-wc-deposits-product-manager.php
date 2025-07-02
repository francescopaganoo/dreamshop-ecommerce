<?php
/**
 * Deposits plan product manager
 *
 * @package woocommerce-deposits
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WC_Deposits_Product_Manager class.
 */
class WC_Deposits_Product_Manager {

	/**
	 * Initialize hooks and filters.
	 */
	public static function init() {
		add_action( 'save_post', array( __CLASS__, 'maybe_clean_deposit_meta' ), 20 );
		add_action( 'woocommerce_admin_process_variation_object', array( __CLASS__, 'maybe_clean_deposit_meta' ), 20 );
	}

	/**
	 * Are deposits enabled for a specific product.
	 *
	 * @param  int $product_id Product ID.
	 * @return bool
	 */
	public static function deposits_enabled( $product_id ) {
		$product = wc_get_product( $product_id );

		if ( ! $product || $product->is_type( array( 'grouped', 'external', 'bundle', 'composite' ) ) ) {
			return false;
		}

		$setting = WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_enabled' );

		if ( empty( $setting ) ) {
			$setting = get_option( 'wc_deposits_default_enabled', 'no' );
		}

		if ( 'optional' === $setting || 'forced' === $setting ) {
			if ( 'plan' === self::get_deposit_type( $product_id ) && ! self::has_plans( $product_id ) ) {
				return false;
			}
			return true;
		}
		return false;
	}

	/**
	 * Are deposits forced for a specific product?
	 *
	 * @param  int $product_id Product ID.
	 * @return bool
	 */
	public static function deposits_forced( $product_id ) {
		$setting = WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_enabled' );
		if ( empty( $setting ) ) {
			$setting = get_option( 'wc_deposits_default_enabled', 'no' );
		}
		return 'forced' === $setting;
	}

	/**
	 * Get deposit type.
	 *
	 * @param  int $product_id Product ID.
	 * @return string
	 */
	public static function get_deposit_type( $product_id ) {
		$setting = WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_type' );
		if ( ! $setting ) {
			$setting = get_option( 'wc_deposits_default_type', 'percent' );
		}
		return $setting;
	}

	/**
	 * Get deposit selected type.
	 *
	 * @param  int $product_id Product ID.
	 * @return string
	 */
	public static function get_deposit_selected_type( $product_id ) {
		// If deposits are required, always return `deposit` as the selected type.
		if ( self::deposits_forced( $product_id ) ) {
			return 'deposit';
		}

		$setting = WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_selected_type' );
		if ( ! $setting ) {
			$setting = get_option( 'wc_deposits_default_selected_type', 'deposit' );
		}
		return $setting;
	}

	/**
	 * Get global deposit settings.
	 *
	 * @return array Global deposit settings data
	 */
	public static function get_global_settings() {
		$settings_data = array(
			'enabled'        => null,
			'method'         => null,
			'default_option' => null,
			'type'           => null,
			'amount'         => null,
		);

		$enabled = get_option( 'wc_deposits_default_enabled', 'no' );
		$type    = get_option( 'wc_deposits_default_type', 'percent' );

		// Set deposit type.
		switch ( $type ) {
			case 'percent':
				$settings_data['type'] = sprintf( __( 'Percentage', 'woocommerce-deposits' ), $settings_data['amount'] );
				break;
			case 'fixed':
				$settings_data['type'] = sprintf( __( 'Fixed', 'woocommerce-deposits' ), $settings_data['amount'], get_woocommerce_currency() );
				break;
			case 'plan':
				$settings_data['type'] = __( 'Payment plan', 'woocommerce-deposits' );
				break;
			default:
				$settings_data['type'] = __( 'None', 'woocommerce-deposits' );
				break;
		}

		$settings_data['amount'] = get_option( 'wc_deposits_default_amount' );

		$settings_data['formatted_type_amount'] = sprintf(
			/* translators: Percentage/Fixed Amount/Payment Plan */
			'%1$s%2$s',
			$settings_data['type'],
			self::get_deposit_amount_display( $settings_data )
		);

		// Set enabled status and method.
		if ( 'optional' === $enabled ) {
			$settings_data['enabled']        = __( 'Yes', 'woocommerce-deposits' );
			$settings_data['method']         = __( 'Optional', 'woocommerce-deposits' );
			$settings_data['default_option'] = 'deposit' === get_option( 'wc_deposits_default_selected_type', 'deposit' )
				? __( 'Pay deposit', 'woocommerce-deposits' )
				: __( 'Pay in full', 'woocommerce-deposits' );
		} elseif ( 'forced' === $enabled ) {
			$settings_data['enabled']        = __( 'Yes', 'woocommerce-deposits' );
			$settings_data['method']         = __( 'Required', 'woocommerce-deposits' );
			$settings_data['default_option'] = __( 'Not applicable', 'woocommerce-deposits' );
		} else {
			$settings_data['enabled']               = __( 'No', 'woocommerce-deposits' );
			$settings_data['method']                = __( 'Not applicable', 'woocommerce-deposits' );
			$settings_data['default_option']        = __( 'Not applicable', 'woocommerce-deposits' );
			$settings_data['formatted_type_amount'] = __( 'Not applicable', 'woocommerce-deposits' );
		}

		return $settings_data;
	}

	/**
	 * Get formatted deposit amount display string.
	 *
	 * @param array $settings_data Settings data containing amount and payment plan details.
	 * @return string Formatted deposit amount string with currency/percentage symbol.
	 */
	public static function get_deposit_amount_display( $settings_data ) {
		if ( empty( $settings_data['amount'] ) ) {
			return '';
		}

		$deposit_type = get_option( 'wc_deposits_default_type', 'percent' );
		$amount       = $settings_data['amount'];

		switch ( $deposit_type ) {
			case 'percent':
				return sprintf( ' (%s%%)', $amount );
			case 'fixed':
				return sprintf( ' (%s %s%s)', get_woocommerce_currency(), get_woocommerce_currency_symbol(), $amount );
			case 'plan':
				if ( empty( $settings_data['payment_plans'] ) ) {
					return '';
				}
				return sprintf(
					' (%s %s)',
					__( 'Plan:', 'woocommerce-deposits' ),
					implode( ', ', $settings_data['payment_plans'] )
				);
			default:
				return '';
		}
	}

	/**
	 * Returns the label for the setting depending on store and product level inheritance.
	 *
	 * @since 2.2.6
	 *
	 * @param string $setting      Setting name. enabled, deposit_type, deposit_selected_type.
	 * @param string $product_type Product type. simple or variation.
	 *
	 * @return string
	 */
	public static function get_setting_inheritance_label( $setting = '', $product_type = 'simple' ) {
		$label = '';

		switch ( $product_type ) {
			case 'simple':
				$label = esc_html__( 'Inherit storewide settings', 'woocommerce-deposits' );
				break;

			case 'variation':
				return esc_html__( 'Inherit product settings', 'woocommerce-deposits' );
		}

		if ( 'enabled' === $setting ) {
			switch ( get_option( 'wc_deposits_default_enabled', 'no' ) ) {
				case 'optional':
					$label .= ' (' . esc_html__( 'yes, optional', 'woocommerce-deposits' ) . ')';
					break;

				case 'forced':
					$label .= ' (' . esc_html__( 'yes, required', 'woocommerce-deposits' ) . ')';
					break;

				case 'no':
					$label .= ' (' . esc_html__( 'no', 'woocommerce-deposits' ) . ')';
					break;
			}
		} elseif ( 'deposit_type' === $setting ) {
			switch ( get_option( 'wc_deposits_default_type', 'percent' ) ) {
				case 'percent':
					$label .= ' (' . esc_html__( 'percent', 'woocommerce-deposits' ) . ')';
					break;

				case 'fixed':
					$label .= ' (' . esc_html__( 'fixed amount', 'woocommerce-deposits' ) . ')';
					break;

				case 'plan':
					$label .= ' (' . esc_html__( 'payment plan', 'woocommerce-deposits' ) . ')';
					break;

				case 'none':
					$label .= ' (' . esc_html__( 'none', 'woocommerce-deposits' ) . ')';
					break;
			}
		} elseif ( 'deposit_selected_type' === $setting ) {
			switch ( get_option( 'wc_deposits_default_selected_type', 'deposit' ) ) {
				case 'deposit':
					$label .= ' (' . esc_html__( 'pay deposit', 'woocommerce-deposits' ) . ')';
					break;

				case 'full':
					$label .= ' (' . esc_html__( 'pay in full', 'woocommerce-deposits' ) . ')';
					break;
			}
		}

		return $label;
	}

	/**
	 * Does the product have plans?
	 *
	 * @param  int $product_id Product ID.
	 * @return int
	 */
	public static function has_plans( $product_id ) {
		$plans = count( array_map( 'absint', array_filter( (array) WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_payment_plans' ) ) ) );
		if ( $plans <= 0 ) {
			$default_payment_plans = get_option( 'wc_deposits_default_plans', array() );
			if ( empty( $default_payment_plans ) ) {
				return 0;
			}
			return count( $default_payment_plans );
		}
		return $plans;
	}

	/**
	 * Formatted deposit amount for a product based on fixed or %.
	 *
	 * @param  int $product_id Product ID.
	 * @return string
	 */
	public static function get_formatted_deposit_amount( $product_id ) {
		$product = wc_get_product( $product_id );

		$amount = self::get_deposit_amount_for_display( $product );

		if ( $amount ) {
			$type = self::get_deposit_type( $product_id );

			if ( $product->is_type( 'booking' ) && 'yes' === WC_Deposits_Product_Meta::get_meta( $product_id, '_wc_deposit_multiple_cost_by_booking_persons' ) ) {
				$item = __( 'person', 'woocommerce-deposits' );
			} else {
				$item = __( 'item', 'woocommerce-deposits' );
			}

			$sold_individually = $product->is_sold_individually();

			if ( 'percent' === $type ) {
				if ( $sold_individually ) {
					/* translators: %s is the deposit amount to be paid */
					return sprintf( __( 'Pay a %s deposit', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>' );
				} else {
					/* translators: percent per item/person */
					return sprintf( __( 'Pay a %1$s deposit per %2$s', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>', $item );
				}
			} elseif ( $sold_individually ) {
				/* translators: %s is the deposit amount to be paid */
				return sprintf( __( 'Pay a deposit of %s', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>' );
			} else {
				/* translators: amount per item/person */
				return sprintf( __( 'Pay a deposit of %1$s per %2$s', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>', $item );
			}
		}
		return '';
	}

	/**
	 * Formatted deposit amount for a product based on payment plan.
	 *
	 * @param  int $product_id Product ID.
	 * @param  int $plan_id    Payment Plan ID.
	 * @return string
	 */
	public static function get_formatted_deposit_payment_plan_amount( $product_id, $plan_id ) {
		$product = wc_get_product( $product_id );
		$amount  = self::get_deposit_amount_for_display( $product, $plan_id );

		$sold_individually = $product->is_sold_individually();

		if ( $amount ) {
			if ( $sold_individually ) {
				/* translators: %s is the deposit amount to be paid */
				return sprintf( __( 'Pay a deposit of %s', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>' );
			} else {
				/* translators: %s is the deposit amount to be paid */
				return sprintf( __( 'Pay a %s deposit per item', 'woocommerce-deposits' ), '<span class="wc-deposits-amount">' . $amount . '</span>' );
			}
		}
		return '';
	}

	/**
	 * Deposit amount for a product based on fixed or %.
	 *
	 * @param  WC_Product|int $product Product.
	 * @param  int            $plan_id Plan ID.
	 * @return float|bool
	 */
	public static function get_deposit_amount_for_display( $product, $plan_id = 0 ) {
		if ( is_numeric( $product ) ) {
			$product = wc_get_product( $product );
		}
		$type       = self::get_deposit_type( $product->get_id() );
		$percentage = false;

		if ( in_array( $type, array( 'fixed', 'percent' ), true ) ) {
			$amount = WC_Deposits_Product_Meta::get_meta( $product->get_id(), '_wc_deposit_amount' );

			if ( ! $amount ) {
				$amount = get_option( 'wc_deposits_default_amount' );
			}

			if ( ! $amount ) {
				return false;
			}

			if ( 'percent' === $type ) {
				$percentage = true;
			}
		} else {
			if ( ! $plan_id ) {
				return false;
			}

			$plan          = new WC_Deposits_Plan( $plan_id );
			$schedule      = $plan->get_schedule();
			$first_payment = current( $schedule );
			$amount        = $first_payment->amount;
			$percentage    = true;
		}

		if ( ! $percentage ) {
			/**
			 * Filters fixed amount deposit value.
			 * This filter is used by "WooCommerce Multi-Currency" plugin to convert deposit amount to specific currency.
			 *
			 * @param float      $amount  Fixed amount deposit value.
			 * @param WC_Product $product WC_Product object.
			 */
			$amount = apply_filters( 'woocommerce_deposits_fixed_deposit_amount', $amount, $product );
			return wc_price( self::get_price( $product, $amount ) );
		} else {
			return $amount . '%';
		}
	}

	/**
	 * Deposit amount for a product based on fixed or % using actual prices.
	 *
	 * @param  WC_Product|int $product Product.
	 * @param  int            $plan_id Plan ID.
	 * @param  string         $context of display Valid values display or order.
	 * @param  float          $product_price If the price differs from that set in the product.
	 * @return float|bool
	 */
	public static function get_deposit_amount( $product, $plan_id = 0, $context = 'display', $product_price = null ) {
		if ( is_numeric( $product ) ) {
			$product = wc_get_product( $product );
		}
		$type       = self::get_deposit_type( $product->get_id() );
		$percentage = false;

		if ( in_array( $type, array( 'fixed', 'percent' ), true ) ) {
			$amount = WC_Deposits_Product_Meta::get_meta( $product->get_id(), '_wc_deposit_amount' );

			if ( ! $amount ) {
				$amount = get_option( 'wc_deposits_default_amount' );
			}

			if ( ! $amount ) {
				return false;
			}

			if ( 'percent' === $type ) {
				$percentage = true;
			}
		} else {
			if ( ! $plan_id ) {
				return false;
			}

			$plan          = new WC_Deposits_Plan( $plan_id );
			$schedule      = $plan->get_schedule();
			$first_payment = current( $schedule );
			$amount        = $first_payment->amount;
			$percentage    = true;
		}

		if ( $percentage ) {
			$product_price = is_null( $product_price ) ? $product->get_price() : $product_price;
			$amount        = ( $product_price / 100 ) * $amount;
		} else {
			/**
			 * Filters fixed amount deposit value.
			 * This filter is used by "WooCommerce Multi-Currency" plugin to convert deposit amount to specific currency.
			 *
			 * @param float      $amount  Fixed amount deposit value.
			 * @param WC_Product $product WC_Product object.
			 */
			$amount = apply_filters( 'woocommerce_deposits_fixed_deposit_amount', $amount, $product );
		}

		$price = 'display' === $context ? self::get_price( $product, $amount ) : $amount;
		return wc_format_decimal( $price );
	}

	/**
	 * Get correct price/amount depending on tax mode.
	 *
	 * @since  1.2.0
	 * @param  WC_Product $product Product.
	 * @param  float      $amount Amount.
	 * @return float
	 */
	protected static function get_price( $product, $amount ) {
		return wc_get_price_to_display(
			$product,
			array(
				'qty'   => 1,
				'price' => $amount,
			)
		);
	}

	/**
	 * Checks if a product or variation has any custom deposit settings enabled.
	 *
	 * @param int $product_id The product or product variation ID to check.
	 * @return bool True if product has custom deposit settings, false otherwise.
	 */
	public static function product_has_custom_settings( $product_id ) {
		$product_settings_meta_keys = array(
			'_wc_deposit_enabled',
			'_wc_deposit_type',
			'_wc_deposit_selected_type',
			'_wc_deposit_amount',
			'_wc_deposit_payment_plans',
		);

		foreach ( $product_settings_meta_keys as $meta_key ) {
			if ( get_post_meta( $product_id, $meta_key, true ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if the deposits override settings checkbox were disabled for a post.
	 *
	 * @param int $product_id The product (or variation) ID.
	 * @return bool True if custom configuration is disabled, false if enabled.
	 */
	public static function is_custom_deposits_configuration_disabled( $product_id ) {
		$checkbox_name = '_wc_deposit_override_product_settings' . ( 'product_variation' === get_post_type( $product_id ) ? '_variation_' . $product_id : '' );

		// This is the value of hidden field before the checkbox in the product edit screen.
		$enable_custom_settings_for_post = sanitize_text_field( wp_unslash( isset( $_POST[ $checkbox_name ] ) ? $_POST[ $checkbox_name ] : '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( 'disabled' === $enable_custom_settings_for_post ) {
			return true;
		}
		return false;
	}

	/**
	 * Clean up deposit meta fields if custom configuration is disabled,
	 * to revert to global/parent settings.
	 *
	 * @param mixed $product_id_or_object The product ID or product object.
	 */
	public static function maybe_clean_deposit_meta( $product_id_or_object ) {
		$product_id = is_object( $product_id_or_object ) ? $product_id_or_object->get_id() : $product_id_or_object;

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( ! in_array( get_post_type( $product_id ), array( 'product', 'product_variation' ), true ) ) {
			return;
		}

		// If custom configuration is disabled, clean up deposit meta fields.
		if ( self::is_custom_deposits_configuration_disabled( $product_id ) ) {
			$deposit_related_meta_keys = array(
				'_wc_deposit_enabled',
				'_wc_deposit_type',
				'_wc_deposit_selected_type',
				'_wc_deposit_amount',
				'_wc_deposit_payment_plans',
				'_wc_deposit_multiple_cost_by_booking_persons',
			);

			// Delete all deposit related meta for this product/variation.
			foreach ( $deposit_related_meta_keys as $meta_key ) {
				delete_post_meta( $product_id, $meta_key );
			}
		}
	}
}
