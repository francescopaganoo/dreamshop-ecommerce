<?php
/**
 * Deposits form for product edit screen.
 *
 * @package woocommerce-deposits
 */

global $post;

/**
 * Set up variables for deposit form display based on context.
 * For variations, append loop index to IDs/names and use variation-specific classes and data.
 * For main product, use base IDs/names and standard panel classes.
 * This allows the same form template to work for both product and variation deposit settings.
 */
if ( isset( $loop ) && isset( $variation ) ) {
	/**
	 * This variable is defined to make code more readable.
	 *
	 * $loop and $variation are set when displaying a variation's settings page.
	 * If not set, we're on the main product page.
	*/
	$is_variation_settings_page = true;

	$id_suffix   = '_' . $loop;
	$name_suffix = '[' . $loop . ']';
	$class       = 'woocommerce_variation_deposits form-row';
	$product     = $variation;
	$data_type   = 'variation';
} else {
	$is_variation_settings_page = false;

	$id_suffix   = '';
	$name_suffix = '';
	$class       = 'panel woocommerce_options_panel';
	$product     = $post;
	$data_type   = 'product';
}
?>

<div id="deposits<?php echo esc_attr( $id_suffix ); ?>" class="<?php echo esc_attr( $class ); ?>" data-type="<?php echo esc_attr( $data_type ); ?>">

	<div class="options_group">

	<?php if ( $is_variation_settings_page ) : ?>
		<div class="wc-deposits-product-settings-storewide-info">
			<h4 class="variation_message">
				<?php echo esc_html__( 'Deposit settings will be inherited from the parent product if not customized for the variation.', 'woocommerce-deposits' ); ?>
				<?php echo wp_kses_post( wc_help_tip( esc_html__( 'The parent product deposit settings apply to all variations unless customized below.', 'woocommerce-deposits' ) ) ); ?>
			</h4>
		</div>
	<?php else : ?>
		<div class="wc-deposits-product-settings-storewide-info">
			<h4>
				<?php echo esc_html__( 'Storewide Deposit Settings', 'woocommerce-deposits' ); ?>
				<?php echo wp_kses_post( wc_help_tip( esc_html__( 'These settings apply to all products unless customized below.', 'woocommerce-deposits' ) ) ); ?>
				<?php echo "<a href='" . esc_url( admin_url( 'admin.php?page=wc-settings&tab=products&section=deposits' ) ) . "' target='_blank' class='button button-small' title='" . esc_html__( 'Configure the default deposit settings that apply to your entire store.', 'woocommerce-deposits' ) . "'>" . esc_html__( 'Manage Storewide Deposit Settings', 'woocommerce-deposits' ) . '</a>'; ?>
			</h4>
			<?php
			$settings_data  = WC_Deposits_Product_Manager::get_global_settings();
			$settings_parts = array(
				array(
					/* translators: Yes/No */
					'text' => sprintf( __( '<b>Deposits Enabled:</b> %1$s', 'woocommerce-deposits' ), $settings_data['enabled'] ),
					'tip'  => esc_html__( 'Controls whether deposits are allowed or not. If disabled, customers must pay in full, i.e., the default payment option for WooCommerce.', 'woocommerce-deposits' ),
				),
				array(
					/* translators: Optional/Required/Disabled */
					'text' => sprintf( __( '<b>Deposit Requirement:</b> %1$s', 'woocommerce-deposits' ), $settings_data['method'] ),
					'tip'  => esc_html__( 'Determines whether a deposit is <b>Optional</b> (customers can choose to pay through a deposit or pay in full), <b>Required</b> (customers must pay using a deposit, paying the full amount isn\'t allowed) or <b>Disabled</b> (deposits are not allowed).', 'woocommerce-deposits' ),
				),
				array(
					/* translators: Deposit/Full */
					'text' => sprintf( __( '<b>Default Payment Option:</b> %1$s', 'woocommerce-deposits' ), $settings_data['default_option'] ),
					'tip'  => __( 'Controls the default payment selection that appears pre-selected at the product page, when paying using deposits is marked as <b>Optional</b>. This option is ignored if the deposit requirement is set to <b>Required</b>.', 'woocommerce-deposits' ),
				),
				array(
					'text' => sprintf(
						/* translators: Percentage/Fixed Amount/Payment Plan OR Not Applicable */
						__( '<b>Deposit Type:</b> %s', 'woocommerce-deposits' ),
						$settings_data['formatted_type_amount']
					),
					'tip'  => esc_html__( 'Choose how the deposit is calculated - e.g., a fixed amount, a percentage of the product price, or a payment plan.', 'woocommerce-deposits' ),
				),
			);

			echo '<div class="wc-deposits-product-settings-storewide-details">';

			$total_items      = count( $settings_parts );
			$items_per_column = ceil( $total_items / 2 );

			// Render settings items.
			$render_settings_items = function ( $start, $end ) use ( $settings_parts ) {
				echo '<div class="wc-deposits-product-settings-column">';
				for ( $i = $start; $i < $end; $i++ ) {
					if ( isset( $settings_parts[ $i ] ) ) {
						printf(
							'<div class="wc-deposits-product-settings-item">%s%s</div>',
							wp_kses_post( $settings_parts[ $i ]['text'] ),
							wp_kses_post( wc_help_tip( $settings_parts[ $i ]['tip'] ) )
						);
					}
				}
				echo '</div>';
			};

			// Render first column.
			$render_settings_items( 0, $items_per_column );

			// Render second column.
			$render_settings_items( $items_per_column, $total_items );

			echo '</div>';
	?>
		</div>
	<?php endif; ?>

		<!-- Checkbox to enable/disable custom deposit settings for the product/variation. -->
		<div class="wc-deposits-product-settings-override">

			<?php
				$field_name  = '_wc_deposit_override_product_settings';
				$field_name .= ( $is_variation_settings_page ? '_variation_' . $product->ID : '' );
			?>

			<input
				type="hidden"
				name="<?php echo esc_attr( $field_name ); ?>"
				value="disabled"
			/>

			<input
				type="checkbox"
				name="<?php echo esc_attr( $field_name ); ?>"
				id="<?php echo esc_attr( $field_name ) . '_' . esc_attr( $id_suffix ); ?>"
				value="enabled"
				class="checkbox"
				<?php checked( WC_Deposits_Product_Manager::product_has_custom_settings( $product->ID ), true ); ?>
			/>

			<label class="wc-deposits-product-settings-override-label" for="<?php echo esc_attr( $field_name ) . '_' . esc_attr( $id_suffix ); ?>">
				<?php
				if ( $is_variation_settings_page ) {
					$label_text = esc_html__( 'Enable custom deposit settings for this variation', 'woocommerce-deposits' );
					$help_text  = esc_html__( 'Allows additional deposit settings for this variation, overriding parent product settings. If unchecked, parent product deposit settings remain in effect.', 'woocommerce-deposits' );
				} else {
					$label_text = esc_html__( 'Enable custom deposit settings for this product', 'woocommerce-deposits' );
					$help_text  = esc_html__( 'Allows additional deposit settings for this product, overriding storewide global settings. If unchecked, storewide global settings remain in effect.', 'woocommerce-deposits' );
				}

				echo esc_html( $label_text );
				echo wp_kses_post( wc_help_tip( $help_text ) );
				?>
			</label>
		</div>

		<?php
		/**
		 * Container for product-specific or variation-specific deposit settings.
		 * Only visible when custom settings are found for this product/variation.
		 * The visibility is controlled by the checkbox above and toggled via JavaScript.
		 */
		?>
		<div class="wc-deposits-product-settings-override-container <?php echo WC_Deposits_Product_Manager::product_has_custom_settings( $product->ID ) ? 'visible' : 'hidden'; ?>">

		<?php

		woocommerce_wp_select(
			array(
				'id'                => '_wc_deposit_enabled' . $id_suffix,
				'name'              => '_wc_deposit_enabled' . $name_suffix,
				'label'             => __( 'Deposit Setting', 'woocommerce-deposits' ),
				'class'             => 'wc-enhanced-select select _wc_deposit_enabled',
				'options'           => array(
					'no'       => __( 'Disabled', 'woocommerce-deposits' ),
					'optional' => __( 'Optional', 'woocommerce-deposits' ),
					'forced'   => __( 'Required', 'woocommerce-deposits' ),
				),
				'style'             => 'min-width:50%;',
				'desc_tip'          => true,
				'description'       => __( 'Determines whether a deposit is <b>Optional</b> (customers can choose to pay through a deposit or pay in full), <b>Required</b> (customers must pay using a deposit, paying the full amount isn\'t allowed) or <b>Disabled</b> (deposits are not allowed).', 'woocommerce-deposits' ),
				'wrapper_class'     => '_wc_deposit_enabled_field',
				'value'             => get_post_meta( $product->ID, '_wc_deposit_enabled', true ),
				'custom_attributes' => array(
					'data-default-value' => get_option( 'wc_deposits_default_enabled', 'no' ),
				),
			)
		);

		woocommerce_wp_select(
			array(
				'id'            => '_wc_deposit_selected_type' . $id_suffix,
				'name'          => '_wc_deposit_selected_type' . $name_suffix,
				'label'         => __( 'Default Option', 'woocommerce-deposits' ),
				'class'         => 'wc-enhanced-select select _wc_deposit_selected_type',
				'description'   => __( 'The payment method which appears pre-selected at the product page, when paying using deposits is optional. This option is ignored if the deposit requirement is set to <b>Required</b>.', 'woocommerce-deposits' ),
				'options'       => array(
					'deposit' => __( 'Pay Deposit', 'woocommerce-deposits' ),
					'full'    => __( 'Pay in Full', 'woocommerce-deposits' ),
				),
				'style'         => 'min-width:50%;',
				'desc_tip'      => true,
				'wrapper_class' => '_wc_deposit_selected_type_field',
				'value'         => get_post_meta( $product->ID, '_wc_deposit_selected_type', true ),
			)
		);

		woocommerce_wp_select(
			array(
				'id'            => '_wc_deposit_type' . $id_suffix,
				'name'          => '_wc_deposit_type' . $name_suffix,
				'label'         => __( 'Deposit Type', 'woocommerce-deposits' ),
				'class'         => 'wc-enhanced-select select _wc_deposit_type form-row form-row-full',
				'description'   => __( 'Choose how customers can pay for this product with deposits.', 'woocommerce-deposits' ),
				'options'       => array(
					'percent' => __( 'Percentage', 'woocommerce-deposits' ),
					'fixed'   => __( 'Fixed Amount', 'woocommerce-deposits' ),
					'plan'    => __( 'Payment Plan', 'woocommerce-deposits' ),
				),
				'style'         => 'min-width:50%;',
				'desc_tip'      => true,
				'wrapper_class' => '_wc_deposit_type_field',
				'value'         => get_post_meta( $product->ID, '_wc_deposit_type', true ),
			)
		);

		woocommerce_wp_checkbox(
			array(
				'id'            => '_wc_deposit_multiple_cost_by_booking_persons' . $id_suffix,
				'name'          => '_wc_deposit_multiple_cost_by_booking_persons' . $name_suffix,
				'label'         => __( 'Booking Persons', 'woocommerce-deposits' ),
				'description'   => __( 'Multiply fixed deposits by the number of persons booking', 'woocommerce-deposits' ),
				'wrapper_class' => '_wc_deposit_multiple_cost_by_booking_persons_field show_if_booking',
				'class'         => '_wc_deposit_multiple_cost_by_booking_persons',
				'value'         => get_post_meta( $product->ID, '_wc_deposit_multiple_cost_by_booking_persons', true ),
			)
		);

		woocommerce_wp_text_input(
			array(
				'id'            => '_wc_deposit_amount' . $id_suffix,
				'name'          => '_wc_deposit_amount' . $name_suffix,
				'label'         => __( 'Deposit Amount', 'woocommerce-deposits' ),
				'placeholder'   => wc_format_localized_price( 0 ),
				'description'   => __( 'Enter the deposit amount. Do not include currency or percent symbols.', 'woocommerce-deposits' ),
				'data_type'     => 'price',
				'desc_tip'      => true,
				'wrapper_class' => '_wc_deposit_amount_field',
				'class'         => '_wc_deposit_amount',
				'value'         => get_post_meta( $product->ID, '_wc_deposit_amount', true ),
			)
		);

		?>

		<input type="hidden" class="_wc_deposits_default_enabled_field" value="<?php echo esc_attr( get_option( 'wc_deposits_default_enabled', 'no' ) ); ?>" />
		<input type="hidden" class="_wc_deposits_default_type_field" value="<?php echo esc_attr( get_option( 'wc_deposits_default_type', 'percent' ) ); ?>" />
		<input type="hidden" class="_wc_deposits_default_plans_field" value="<?php echo esc_attr( implode( ',', get_option( 'wc_deposits_default_plans', array() ) ) ); ?>" />
		<input type="hidden" class="_wc_deposits_default_amount_field" value="<?php echo esc_attr( get_option( 'wc_deposits_default_amount' ) ); ?>" />
		<input type="hidden" class="_wc_deposits_default_selected_type_field" value="<?php echo esc_attr( get_option( 'wc_deposits_default_selected_type', 'deposit' ) ); ?>" />

		<p class="form-field _wc_deposit_payment_plans_field">
			<label for="_wc_deposit_payment_plans<?php echo esc_attr( $id_suffix ); ?>"><?php esc_html_e( 'Available Payment Plans', 'woocommerce-deposits' ); ?></label>
			<?php
			$plan_ids              = WC_Deposits_Plans_Manager::get_plan_ids();
			$default_payment_plans = get_option( 'wc_deposits_default_plans', array() );
			if ( ! $plan_ids ) {
				echo esc_html__( 'You have not created any payment plans.', 'woocommerce-deposits' );
				echo ' <a href="' . esc_url( admin_url( 'edit.php?post_type=product&page=deposit_payment_plans' ) ) . '" class="button button-small" target="_blank">' . esc_html__( 'Create a Payment Plan', 'woocommerce-deposits' ) . '</a>';
			} else {
				$values = (array) get_post_meta( $product->ID, '_wc_deposit_payment_plans', true );
				?>
				<select id="_wc_deposit_payment_plans<?php echo esc_attr( $id_suffix ); ?>" name="_wc_deposit_payment_plans<?php echo esc_attr( $name_suffix ); ?>[]" class="wc-enhanced-select _wc_deposit_payment_plans" style="min-width: 50%;" multiple="multiple" data-plans-order="<?php echo esc_attr( join( ',', $values ) ); ?>" placeholder="<?php esc_attr_e( 'Select payment plans', 'woocommerce-deposits' ); ?>">
				<?php
				foreach ( $plan_ids as $plan_id => $name ) {
					echo '<option value="' . esc_attr( $plan_id ) . '" ' . selected( in_array( $plan_id, $values, true ), true, false ) . '>' . esc_attr( $name ) . '</option>';
				}
				?>
				</select><?php echo wp_kses_post( wc_help_tip( esc_html__( 'Choose which payment plans customers can use for this product.', 'woocommerce-deposits' ) ) ); ?>
				<?php
				if ( ! empty( $default_payment_plans ) ) {
					$default_payment_plan_string = '';
					foreach ( $default_payment_plans as $plan_id ) {
						$default_payment_plan_string .= $plan_ids[ $plan_id ] . ',';
					}
					$default_payment_plan_string = rtrim( $default_payment_plan_string, ',' );

					if ( ! isset( $variation ) ) {
						/* translators: default payment plan */
						echo '<span class="description">' . sprintf( esc_html__( '"%s" will be used if no payment plan is selected.', 'woocommerce-deposits' ), '<em>' . esc_html( $default_payment_plan_string ) . '</em>' ) . '</span>';
					} else {
						/* translators: default payment plan */
						echo '<span class="description">' . sprintf( esc_html__( '"%s" will be used if no payment plan is selected.', 'woocommerce-deposits' ), '<em class="variation-default-plans-placeholder"></em>' ) . '</span>';
					}
				}
			}
			?>
		</p>
		</div>
	</div>

</div>